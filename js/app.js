const app = document.getElementById("app");
const navigationLinks = document.querySelectorAll(
    ".app-header nav a"
);

const routes = {
    "/home": {
        title: "Home",
        description:
            "Hier übernehmen wir anschließend dein Dashboard."
    },
    "/projects": {
        title: "Projekte",
        description:
            "Hier übernehmen wir anschließend die Projektübersicht."
    },
    "/calendar": {
        title: "Kalender",
        description:
            "Hier übernehmen wir anschließend den Kalender."
    }
};

function renderRoute() {
    const path = window.location.hash.slice(1) || "/home";

    const route = routes[path] ?? {
        title: "Seite nicht gefunden",
        description:
            "Diese Ansicht gibt es nicht. Wähle oben eine Seite aus."
    };

    document.title = `${route.title} | Plan B`;

    const section = document.createElement("section");
    section.className = "page-card";

    const heading = document.createElement("h1");
    heading.textContent = route.title;
    heading.tabIndex = -1;

    const description = document.createElement("p");
    description.textContent = route.description;

    section.append(heading, description);
    app.replaceChildren(section);

    for (const link of navigationLinks) {
        const isActive = link.getAttribute("href") === `#${path}`;

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    }

    heading.focus({ preventScroll: true });
}

window.addEventListener("hashchange", renderRoute);

renderRoute();