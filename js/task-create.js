import { graphqlRequest } from "./graphql.js";
import { getSession } from "./auth.js";

const CREATE_MEETING = `
    mutation CreateMeeting($projectId: ID!, $input: CreateMeetingInput!) {
        createMeeting(projectId: $projectId, input: $input) {
            meetingId
            message
        }
    }
`;

const CREATE_LONG_TODO = `
    mutation CreateLongToDo($projectId: ID!, $input: CreateLongToDoInput!) {
        createLongToDo(projectId: $projectId, input: $input) {
            longToDoId
            message
        }
    }
`;

export function mountTaskCreate(
    container,
    getProject,
    onCreated,
    onLoginRequired
) {
    const controller = new AbortController();
    const { signal } = controller;
    let isSaving = false;
    let project = null;

    const dialog = document.createElement("dialog");
    dialog.className = "project-detail-dialog task-create-dialog";
    dialog.setAttribute("aria-labelledby", "taskCreateTitle");

    dialog.innerHTML = `
        <div class="project-dialog-head">
            <h2 id="taskCreateTitle">Task anlegen</h2>
            <button type="button" class="project-dialog-close"
                    data-close aria-label="Schließen">×</button>
        </div>

        <form novalidate>
            <fieldset class="task-create-fields">
                <p class="task-create-project"></p>

                <fieldset class="task-type-choice">
                    <legend>Typ</legend>
                    <label>
                        <input type="radio" name="taskType"
                               value="MEETING" checked>
                        Meeting
                    </label>
                    <label>
                        <input type="radio" name="taskType"
                               value="LONG_TODO">
                        Langes To-Do
                    </label>
                </fieldset>

                <label class="task-create-field">Titel *
                    <input name="title" type="text"
                           maxlength="100" required>
                </label>

                <label class="task-create-field">Beschreibung
                    <textarea name="description"
                              maxlength="2000" rows="3"></textarea>
                </label>

                <div class="task-create-dates">
                    <label class="task-create-field">Start *
                        <input name="startDateTime"
                               type="datetime-local"
                               step="900" required>
                    </label>
                    <label class="task-create-field">
                        <span class="task-end-label">Ende *</span>
                        <input name="endDateTime"
                               type="datetime-local"
                               step="900" required>
                    </label>
                </div>

                <fieldset class="task-members">
                    <legend>Teilnehmer *</legend>
                    <label class="task-member-option">
                        <input type="checkbox" class="task-all-members">
                        Alle Projektmitglieder
                    </label>
                    <div class="task-member-options"></div>
                </fieldset>

                <fieldset class="task-long-fields" hidden disabled>
                    <label class="task-create-field">Priorität *
                        <select name="priority">
                            <option value="HIGH">Hoch</option>
                            <option value="MEDIUM" selected>Mittel</option>
                            <option value="LOW">Niedrig</option>
                        </select>
                    </label>

                    <h3>Teilaufgaben</h3>
                    <p class="project-muted">
                        Optional. Neue Teilaufgaben sind zunächst
                        nicht zugewiesen.
                    </p>
                    <div class="task-subtask-editor"></div>
                    <button type="button" class="task-add-subtask">
                        + Teilaufgabe hinzufügen
                    </button>
                </fieldset>
            </fieldset>

            <div class="task-create-feedback">
                <p class="form-error" role="alert" tabindex="-1"></p>
                <button type="button" class="task-create-login" hidden>
                    Erneut anmelden
                </button>
            </div>

            <div class="project-dialog-foot">
                <button type="button" data-close>Abbrechen</button>
                <button type="submit" class="task-create-submit">
                    Anlegen
                </button>
            </div>
        </form>
    `;

    container.append(dialog);

    const form = dialog.querySelector("form");
    const fields = dialog.querySelector(".task-create-fields");
    const longFields = dialog.querySelector(".task-long-fields");
    const members = dialog.querySelector(".task-member-options");
    const allMembers = dialog.querySelector(".task-all-members");
    const subtasks = dialog.querySelector(".task-subtask-editor");
    const errorElement = dialog.querySelector(".form-error");
    const loginButton = dialog.querySelector(".task-create-login");
    const submitButton = dialog.querySelector('[type="submit"]');
    const closeButtons = dialog.querySelectorAll("[data-close]");
    const field = name => form.elements.namedItem(name);

    function showError(message) {
        errorElement.textContent = message;
        errorElement.focus();
    }

    function updateType() {
        const isMeeting = field("taskType").value === "MEETING";

        longFields.hidden = isMeeting;
        longFields.disabled = isMeeting;
        field("title").maxLength = isMeeting ? 100 : 150;

        dialog.querySelector(".task-end-label").textContent =
            isMeeting ? "Ende *" : "Frist *";

        errorElement.textContent = "";
    }

    function updateAllMembers() {
        const boxes = [...members.querySelectorAll("input")];
        const selected = boxes.filter(box => box.checked).length;

        allMembers.checked =
            boxes.length > 0 && selected === boxes.length;

        allMembers.indeterminate =
            selected > 0 && selected < boxes.length;
    }

    function addSubtask() {
        const row = document.createElement("fieldset");
        row.className = "task-subtask-row";

        row.innerHTML = `
            <legend>Teilaufgabe</legend>

            <label class="task-create-field">Titel *
                <input data-sub-title type="text"
                       maxlength="150" required>
            </label>

            <label class="task-create-field">Beschreibung
                <textarea data-sub-description
                          maxlength="2000" rows="2"></textarea>
            </label>

            <label class="task-create-field">Priorität
                <select data-sub-priority>
                    <option value="HIGH">Hoch</option>
                    <option value="MEDIUM" selected>Mittel</option>
                    <option value="LOW">Niedrig</option>
                </select>
            </label>

            <button type="button" data-remove-subtask>
                Teilaufgabe entfernen
            </button>
        `;

        subtasks.append(row);
        row.querySelector("input").focus();
    }

    function setBusy(busy) {
        isSaving = busy;
        fields.disabled = busy;
        submitButton.disabled = busy;

        closeButtons.forEach(button => {
            button.disabled = busy;
        });

        submitButton.textContent =
            busy ? "Wird angelegt …" : "Anlegen";

        form.setAttribute("aria-busy", String(busy));
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (isSaving || signal.aborted) return;

        errorElement.textContent = "";
        loginButton.hidden = true;
        field("title").value = field("title").value.trim();

        subtasks.querySelectorAll("[data-sub-title]").forEach(input => {
            input.value = input.value.trim();
        });

        if (!form.reportValidity()) return;

        const participantIds = [
            ...members.querySelectorAll("input:checked")
        ].map(input => input.value);

        if (!participantIds.length) {
            showError("Bitte mindestens ein Mitglied auswählen.");
            return;
        }

        if (field("endDateTime").value <= field("startDateTime").value) {
            showError(
                "Ende beziehungsweise Frist muss nach dem Start liegen."
            );
            return;
        }

        const isMeeting = field("taskType").value === "MEETING";

        const input = {
            title: field("title").value,
            description: field("description").value.trim(),
            startDateTime: field("startDateTime").value,
            endDateTime: field("endDateTime").value
        };

        if (isMeeting) {
            input.participantIds = participantIds;
        } else {
            input.assignedMemberIds = participantIds;
            input.priority = field("priority").value;
            input.subtasks = [...subtasks.children].map(row => ({
                title: row.querySelector("[data-sub-title]").value.trim(),
                description: row.querySelector(
                    "[data-sub-description]"
                ).value.trim(),
                priority: row.querySelector("[data-sub-priority]").value
            }));
        }

        let created = false;
        setBusy(true);

        try {
            await graphqlRequest(
                isMeeting ? CREATE_MEETING : CREATE_LONG_TODO,
                { projectId: project.projectId, input },
                { signal }
            );

            if (signal.aborted) return;

            created = true;
            dialog.close();
        } catch (error) {
            if (!signal.aborted) {
                showError(error.message);
                loginButton.hidden = error.code !== "AUTH_REQUIRED";
            }
        } finally {
            if (!signal.aborted) setBusy(false);
        }

        if (created && !signal.aborted) {
            await onCreated();
        }
    }, { signal });

    form.addEventListener("change", event => {
        if (event.target.name === "taskType") {
            updateType();
        }
    }, { signal });

    allMembers.addEventListener("change", () => {
        members.querySelectorAll("input").forEach(input => {
            input.checked = allMembers.checked;
        });
        updateAllMembers();
    }, { signal });

    members.addEventListener("change", updateAllMembers, { signal });

    dialog.querySelector(".task-add-subtask").addEventListener(
        "click",
        addSubtask,
        { signal }
    );

    subtasks.addEventListener("click", event => {
        const button = event.target.closest("[data-remove-subtask]");
        if (!button) return;

        button.closest(".task-subtask-row").remove();
        dialog.querySelector(".task-add-subtask").focus();
    }, { signal });

    closeButtons.forEach(button => {
        button.addEventListener("click", () => {
            if (!isSaving) dialog.close();
        }, { signal });
    });

    dialog.addEventListener("cancel", event => {
        if (isSaving) event.preventDefault();
    }, { signal });

    loginButton.addEventListener("click", () => {
        dialog.close();
        onLoginRequired();
    }, { signal });

    return {
        open() {
            if (signal.aborted || isSaving || dialog.open) return;

            project = getProject();

            if (
                !project
                || project.role !== "PROJECT_LEADER"
                || project.status !== "ACTIVE"
            ) {
                return;
            }

            form.reset();
            subtasks.replaceChildren();
            members.replaceChildren();
            errorElement.textContent = "";
            loginButton.hidden = true;

            dialog.querySelector(".task-create-project").textContent =
                `Projekt: ${project.name}`;

            const ownId = getSession()?.userId;

            for (const member of project.members) {
                const label = document.createElement("label");
                label.className = "task-member-option";

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = String(member.userId);
                checkbox.checked =
                    String(member.userId) === String(ownId);

                const name = [member.firstName, member.lastName]
                    .filter(Boolean)
                    .join(" ") || `Mitglied ${member.userId}`;

                label.append(checkbox, document.createTextNode(name));
                members.append(label);
            }

            updateType();
            updateAllMembers();
            dialog.showModal();
            field("title").focus();
        },

        destroy() {
            controller.abort();

            if (dialog.open) dialog.close();
            dialog.remove();
        }
    };
}