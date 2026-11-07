import { graphqlRequest } from "./graphql.js";

const PROJECTS_QUERY = `
    query MyProjects {
        myProjects {
            projectId
            name
            status
            role
        }
    }
`;

const STATUS_LABELS = {
    ACTIVE: "Aktiv",
    COMPLETED: "Abgeschlossen"
};

const ROLE_LABELS = {
    MEMBER: "Teammitglied",
    PROJECT_LEADER: "Projektleitung"
};

export function mountProjects(container, onLoginRequired) {
    const controller = new AbortController();
    let isLoading = false;

    container.innerHTML = `
        <section class="projects-view" aria-labelledby="projectsTitle">
            <h1 id="projectsTitle" tabindex="-1">Meine Projekte</h1>

            <p class="projects-status" role="status"></p>
            <p class="projects-error" role="alert" hidden></p>

            <div class="projects-list"></div>

            <button class="projects-retry" type="button" hidden>
                Erneut versuchen
            </button>

            <button class="projects-login" type="button" hidden>
                Erneut anmelden
            </button>
        </section>
    `;

    const list = container.querySelector(".projects-list");
    const status = container.querySelector(".projects-status");
    const errorElement = container.querySelector(".projects-error");
    const retryButton = container.querySelector(".projects-retry");
    const loginButton = container.querySelector(".projects-login");

    function renderProjects(projects) {
        const fragment = document.createDocumentFragment();

        for (const project of projects) {
            const card = document.createElement("article");
            card.className = "spa-project-card";
            card.classList.toggle(
                "is-closed",
                project.status === "COMPLETED"
            );

            const header = document.createElement("div");
            header.className = "spa-project-card-header";

            const title = document.createElement("h2");

            const projectLink = document.createElement("a");
            projectLink.className = "spa-project-link";
            projectLink.href = `#/projects/${encodeURIComponent(project.projectId)}`;
            projectLink.textContent = project.name;

            title.append(projectLink);

            const badge = document.createElement("span");
            badge.className = "spa-project-status";
            badge.textContent =
                STATUS_LABELS[project.status] ?? project.status;

            const role = document.createElement("p");
            role.textContent =
                `Rolle: ${ROLE_LABELS[project.role] ?? project.role}`;

            header.append(title, badge);
            card.append(header, role);
            fragment.append(card);
        }

        list.replaceChildren(fragment);
    }

    async function loadProjects() {
        if (isLoading || controller.signal.aborted) {
            return;
        }

        isLoading = true;
        status.textContent = "Projekte werden geladen …";
        errorElement.textContent = "";
        errorElement.hidden = true;
        retryButton.hidden = true;
        loginButton.hidden = true;
        list.setAttribute("aria-busy", "true");

        try {
            const data = await graphqlRequest(
                PROJECTS_QUERY,
                {},
                { signal: controller.signal }
            );

            if (controller.signal.aborted) {
                return;
            }

            if (!Array.isArray(data.myProjects)) {
                throw new Error(
                    "Das Backend hat keine gültige Projektliste geliefert."
                );
            }

            renderProjects(data.myProjects);

            status.textContent = data.myProjects.length === 0
                ? "Du bist noch in keinem Projekt."
                : "";
        } catch (error) {
            if (controller.signal.aborted) {
                return;
            }

            status.textContent = "";
            errorElement.textContent = error.message;
            errorElement.hidden = false;

            if (error.code === "AUTH_REQUIRED") {
                loginButton.hidden = false;
            } else {
                retryButton.hidden = false;
            }
        } finally {
            isLoading = false;

            if (!controller.signal.aborted) {
                list.removeAttribute("aria-busy");
            }
        }
    }

    retryButton.addEventListener("click", loadProjects, {
        signal: controller.signal
    });

    loginButton.addEventListener("click", onLoginRequired, {
        signal: controller.signal
    });

    loadProjects();

    return () => controller.abort();
}