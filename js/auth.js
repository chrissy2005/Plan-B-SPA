import { API_BASE_URL } from "./config.js";

const SESSION_KEY = "plan-b-spa-session";

export function getSession() {
    const storedSession = sessionStorage.getItem(SESSION_KEY);

    if (!storedSession) {
        return null;
    }

    try {
        const session = JSON.parse(storedSession);

        if (
            typeof session?.token !== "string"
            || !session.token.trim()
            || session.userId == null
        ) {
            clearSession();
            return null;
        }

        return session;
    } catch {
        clearSession();
        return null;
    }
}

export function getToken() {
    return getSession()?.token ?? null;
}

export function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
}

export async function login(email, password, { signal } = {}) {
    let response;

    try {
        response = await fetch(`${API_BASE_URL}/auth`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email.trim(),
                password
            }),
            cache: "no-store",
            signal
        });
    } catch (error) {
        if (error.name === "AbortError") {
            throw error;
        }

        throw new Error(
            "Die Verbindung zum Backend ist fehlgeschlagen. "
            + "Mögliche Ursachen sind die Netzwerkverbindung, "
            + "ein nicht erreichbarer Server oder die CORS-Konfiguration."
        );
    }

    if (response.status === 401) {
        throw new Error("E-Mail-Adresse oder Passwort ist falsch.");
    }

    if (response.status === 400) {
        throw new Error("Bitte prüfe deine Eingaben.");
    }

    if (!response.ok) {
        throw new Error(
            `Die Anmeldung ist fehlgeschlagen (HTTP ${response.status}).`
        );
    }

    const data = await response.json().catch(() => null);

    if (
        typeof data?.token !== "string"
        || !data.token.trim()
        || data.userId == null
    ) {
        throw new Error(
            "Das Backend hat eine unvollständige Login-Antwort geliefert."
        );
    }

    const session = {
        token: data.token,
        userId: data.userId
    };

    signal?.throwIfAborted();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return session;
}