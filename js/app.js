import { getSession, clearSession } from "./auth.js";
import { mountLogin } from "./login-view.js";

const app = document.getElementById("app");
const navigation = document.getElementById("mainNavigation");
const navigationLinks = navigation.querySelectorAll("a");
const logoutButton = document.getElementById("logoutButton");

let cleanupCurrentView = null;

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

function replaceRoute(path) {
    window.history.replaceState(null, "", `#${path}`);
    renderRoute();
}

function renderPlaceholder(route) {
    const section = document.createElement("section");
    section.className = "page-card";

    const heading = document.createElement("h1");
    heading.textContent = route.title;
    heading.tabIndex = -1;

    const description = document.createElement("p");
    description.textContent = route.description;

    section.append(heading, description);
    app.replaceChildren(section);
}

function renderRoute() {
    if (cleanupCurrentView) {
        cleanupCurrentView();
        cleanupCurrentView = null;
    }

    const session = getSession();
    let path = window.location.hash.slice(1) || "/home";

    // Ohne gespeicherte Anmeldung zur Anmeldeansicht wechseln.
    if (!session && path !== "/login") {
        path = "/login";
        window.history.replaceState(null, "", "#/login");
    } else if (session && path === "/login") {
        path = "/home";
        window.history.replaceState(null, "", "#/home");
    }

    navigation.hidden = !session;
    logoutButton.hidden = !session;
    document.body.classList.toggle("auth-page", path === "/login");

    for (const link of navigationLinks) {
        if (link.getAttribute("href") === `#${path}`) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    }

    if (path === "/login") {
        document.title = "Anmelden | Plan B";

        cleanupCurrentView = mountLogin(app, () => {
            replaceRoute("/home");
        });
    } else {
        const route = routes[path] ?? {
            title: "Seite nicht gefunden",
            description:
                "Diese Ansicht gibt es nicht. Wähle oben eine Seite aus."
        };

        document.title = `${route.title} | Plan B`;
        renderPlaceholder(route);
    }

    app.querySelector("h1")?.focus({ preventScroll: true });
}

logoutButton.addEventListener("click", () => {
    clearSession();
    replaceRoute("/login");
});

window.addEventListener("hashchange", renderRoute);

renderRoute();