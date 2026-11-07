import { graphqlRequest } from "./graphql.js";

const PROJECT_QUERY = `
    query ProjectDetails($projectId: ID!) {
        project(projectId: $projectId) {
            projectId
            name
            description
            status
            role
            members {
                userId
                firstName
                lastName
                role
            }
            meetings {
                meetingId
                title
                description
                startDateTime
                endDateTime
                done
                participantIds
            }
            longToDos {
                longToDoId
                title
                description
                priority
                startDateTime
                endDateTime
                done
                assignedMemberIds
                subtasks {
                    subtaskId
                    title
                    description
                    done
                    assigneeId
                    priority
                }
            }
        }
    }
`;

const STATUS = {
    ACTIVE: "Aktiv",
    COMPLETED: "Abgeschlossen"
};

const ROLE = {
    MEMBER: "Teammitglied",
    PROJECT_LEADER: "Projektleitung"
};

const PRIORITY = {
    HIGH: "Hoch",
    MEDIUM: "Mittel",
    LOW: "Niedrig"
};

function element(tag, className = "", text) {
    const node = document.createElement(tag);
    node.className = className;

    if (text !== undefined) {
        node.textContent = text;
    }

    return node;
}

// Die Backend-Zeitangaben haben keinen Zeitzonenoffset.
// Deshalb formatieren wir sie ohne automatische Zeitverschiebung.
function formatDateTime(value) {
    if (!value) return "–";

    const match = String(value).match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    );

    if (!match) return String(value);

    const [, year, month, day, hour, minute] = match;
    return `${day}.${month}.${year}, ${hour}:${minute}`;
}

function progressText(task) {
    if (task.type === "MEETING") {
        return task.done ? "Erledigt" : "Offen";
    }

    const total = task.subtasks.length;

    if (total === 0) {
        return "Keine Teilaufgaben";
    }

    const done = task.subtasks.filter(subtask => subtask.done).length;
    const percent = Math.round(done / total * 100);

    return `${done}/${total} · ${percent} %`;
}

export function mountProjectDetail(
    container,
    projectId,
    onLoginRequired
) {
    const controller = new AbortController();
    const { signal } = controller;
    let isLoading = false;
    let memberNames = new Map();

    container.innerHTML = `
        <section class="project-detail-view">
            <a class="project-back-link" href="#/projects">
                ← Meine Projekte
            </a>

            <div class="project-detail-heading">
                <h1 tabindex="-1">Projekt</h1>
                <span class="spa-project-status" hidden></span>
                <span class="project-role"></span>
            </div>

            <p class="project-description" hidden></p>
            <p class="project-load-status" role="status"></p>
            <p class="projects-error" role="alert" hidden></p>

            <div class="project-error-actions">
                <button class="project-retry" type="button" hidden>
                    Erneut versuchen
                </button>
                <button class="project-login" type="button" hidden>
                    Erneut anmelden
                </button>
            </div>

            <div class="project-detail-layout" hidden>
                <aside class="project-members-card"
                       aria-labelledby="projectMembersHeading">
                    <h2 id="projectMembersHeading">Mitglieder</h2>
                    <ul class="project-member-list"></ul>
                </aside>

                <section class="project-tasks"
                         aria-labelledby="projectTasksHeading">
                    <h2 id="projectTasksHeading">To-Do's</h2>

                    <div class="project-table-wrap"
                         tabindex="0"
                         role="region"
                         aria-label="Aufgabenübersicht">
                        <table class="project-task-table">
                            <thead>
                                <tr>
                                    <th scope="col">Status</th>
                                    <th scope="col">Titel</th>
                                    <th scope="col">Typ</th>
                                    <th scope="col">Teilnehmer</th>
                                    <th scope="col">Start</th>
                                    <th scope="col">Ende / Frist</th>
                                    <th scope="col">Priorität</th>
                                    <th scope="col">Fortschritt</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>

                    <h2 class="project-done-heading">Erledigt (0)</h2>
                    <ul class="project-done-list"></ul>
                </section>
            </div>

            <dialog class="project-detail-dialog"
                    aria-labelledby="projectTaskDialogTitle">
                <div class="project-dialog-head">
                    <h2 id="projectTaskDialogTitle"></h2>
                    <button class="project-dialog-close"
                            type="button"
                            aria-label="Schließen">×</button>
                </div>

                <div class="project-dialog-body"></div>

                <form method="dialog" class="project-dialog-foot">
                    <button type="submit">Schließen</button>
                </form>
            </dialog>
        </section>
    `;

    const view = container.querySelector(".project-detail-view");
    const heading = view.querySelector("h1");
    const badge = view.querySelector(".spa-project-status");
    const role = view.querySelector(".project-role");
    const description = view.querySelector(".project-description");
    const loadStatus = view.querySelector(".project-load-status");
    const errorElement = view.querySelector(".projects-error");
    const retryButton = view.querySelector(".project-retry");
    const loginButton = view.querySelector(".project-login");
    const layout = view.querySelector(".project-detail-layout");
    const memberList = view.querySelector(".project-member-list");
    const tableBody = view.querySelector("tbody");
    const doneHeading = view.querySelector(".project-done-heading");
    const doneList = view.querySelector(".project-done-list");
    const dialog = view.querySelector("dialog");
    const dialogTitle = view.querySelector("#projectTaskDialogTitle");
    const dialogBody = view.querySelector(".project-dialog-body");

    function memberName(userId) {
        if (userId == null) return "Nicht zugewiesen";

        return memberNames.get(String(userId))
            ?? "Ehemaliges Mitglied";
    }

    function participantsText(task) {
        return task.participantIds.length
            ? task.participantIds.map(memberName).join(", ")
            : "–";
    }

    function addDetail(parent, label, value) {
        parent.append(
            element("dt", "", label),
            element("dd", "", value)
        );
    }

    function openTask(task) {
        const isLong = task.type === "LONG_TODO";

        dialogTitle.textContent = isLong ? "Langes To-Do" : "Meeting";

        const details = element("dl", "project-task-details");

        addDetail(details, "Titel", task.title);
        addDetail(details, "Status", task.done ? "Erledigt" : "Offen");
        addDetail(details, "Start", formatDateTime(task.startDateTime));
        addDetail(
            details,
            isLong ? "Frist" : "Ende",
            formatDateTime(task.endDateTime)
        );
        addDetail(details, "Teilnehmer", participantsText(task));

        if (isLong) {
            addDetail(
                details,
                "Priorität",
                PRIORITY[task.priority] ?? "–"
            );
        }

        addDetail(
            details,
            "Beschreibung",
            task.description || "Keine Beschreibung."
        );

        dialogBody.replaceChildren(details);

        if (isLong) {
            dialogBody.append(
                element("h3", "", "Teilaufgaben"),
                element("p", "project-muted", progressText(task))
            );

            const list = element("ul", "project-subtask-list");

            for (const subtask of task.subtasks) {
                const item = element("li");

                item.append(
                    element("strong", "", subtask.title),
                    element(
                        "p",
                        "project-muted",
                        [
                            subtask.done ? "Erledigt" : "Offen",
                            PRIORITY[subtask.priority] ?? "–",
                            memberName(subtask.assigneeId)
                        ].join(" · ")
                    )
                );

                if (subtask.description) {
                    item.append(
                        element("p", "project-preserve-lines", subtask.description)
                    );
                }

                list.append(item);
            }

            if (task.subtasks.length > 0) {
                dialogBody.append(list);
            }
        }

        dialog.showModal();
    }

    function taskButton(task) {
        const button = element(
            "button",
            "project-task-link",
            task.title
        );

        button.type = "button";
        button.addEventListener("click", () => openTask(task), { signal });

        return button;
    }

    function renderProject(project) {
        heading.textContent = project.name;
        document.title = `${project.name} | Plan B`;

        badge.textContent = STATUS[project.status] ?? project.status;
        badge.hidden = false;

        role.textContent = `Deine Rolle: ${ROLE[project.role] ?? project.role}`;
        description.textContent = project.description
            ? `Beschreibung: ${project.description}`
            : "";
        description.hidden = !project.description;

        memberNames = new Map(
            project.members.map(member => [
                String(member.userId),
                [member.firstName, member.lastName]
                    .filter(Boolean)
                    .join(" ") || `Mitglied ${member.userId}`
            ])
        );

        const sortedMembers = [...project.members].sort((a, b) =>
            Number(b.role === "PROJECT_LEADER")
            - Number(a.role === "PROJECT_LEADER")
        );

        memberList.replaceChildren();

        for (const member of sortedMembers) {
            const item = element("li", "", memberName(member.userId));

            if (member.role === "PROJECT_LEADER") {
                item.append(element("span", "project-muted", " · PL"));
            }

            memberList.append(item);
        }

        const tasks = [
            ...project.meetings.map(meeting => ({
                ...meeting,
                type: "MEETING",
                subtasks: []
            })),
            ...project.longToDos.map(todo => ({
                ...todo,
                type: "LONG_TODO",
                participantIds: todo.assignedMemberIds
            }))
        ].sort((a, b) =>
            (a.startDateTime || a.endDateTime || "").localeCompare(
                b.startDateTime || b.endDateTime || ""
            )
        );

        const openTasks = tasks.filter(task => !task.done);
        const doneTasks = tasks.filter(task => task.done);

        tableBody.replaceChildren();

        for (const task of openTasks) {
            const row = element("tr");
            const titleCell = element("td");
            titleCell.append(taskButton(task));

            row.append(
                element("td", "", "Offen"),
                titleCell,
                element(
                    "td",
                    "",
                    task.type === "MEETING" ? "Meeting" : "Langes To-Do"
                ),
                element("td", "", participantsText(task)),
                element("td", "", formatDateTime(task.startDateTime)),
                element("td", "", formatDateTime(task.endDateTime)),
                element(
                    "td",
                    "",
                    task.type === "MEETING"
                        ? "–"
                        : PRIORITY[task.priority] ?? "–"
                ),
                element("td", "", progressText(task))
            );

            tableBody.append(row);
        }

        if (openTasks.length === 0) {
            const row = element("tr");
            const cell = element(
                "td",
                "project-empty",
                "Keine offenen Aufgaben für dich in diesem Projekt."
            );
            cell.colSpan = 8;
            row.append(cell);
            tableBody.append(row);
        }

        doneHeading.textContent = `Erledigt (${doneTasks.length})`;
        doneList.replaceChildren();
        doneList.hidden = doneTasks.length === 0;

        for (const task of doneTasks) {
            const item = element("li");
            item.append(taskButton(task));
            doneList.append(item);
        }

        layout.hidden = false;
    }

    async function loadProject() {
        if (isLoading || signal.aborted) return;

        isLoading = true;
        loadStatus.textContent = "Projekt wird geladen …";
        errorElement.hidden = true;
        errorElement.textContent = "";
        retryButton.hidden = true;
        loginButton.hidden = true;
        layout.hidden = true;
        layout.setAttribute("aria-busy", "true");

        try {
            const data = await graphqlRequest(
                PROJECT_QUERY,
                { projectId },
                { signal }
            );

            if (signal.aborted) return;

            if (!data.project) {
                throw new Error(
                    "Das Projekt wurde nicht gefunden oder ist für dich nicht zugänglich."
                );
            }

            const project = data.project;

            if (
                !Array.isArray(project.members)
                || !Array.isArray(project.meetings)
                || !Array.isArray(project.longToDos)
            ) {
                throw new Error("Die Projektdaten sind unvollständig.");
            }

            renderProject(project);
            loadStatus.textContent = "";
        } catch (error) {
            if (signal.aborted) return;

            loadStatus.textContent = "";
            errorElement.textContent = error.message;
            errorElement.hidden = false;

            if (error.code === "AUTH_REQUIRED") {
                loginButton.hidden = false;
            } else {
                retryButton.hidden = false;
            }
        } finally {
            isLoading = false;

            if (!signal.aborted) {
                layout.removeAttribute("aria-busy");
            }
        }
    }

    retryButton.addEventListener("click", loadProject, { signal });
    loginButton.addEventListener("click", onLoginRequired, { signal });

    view.querySelector(".project-dialog-close").addEventListener(
        "click",
        () => dialog.close(),
        { signal }
    );

    loadProject();

    return () => {
        controller.abort();

        if (dialog.open) {
            dialog.close();
        }
    };
}