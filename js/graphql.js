import { API_BASE_URL } from "./config.js";
import { getToken } from "./auth.js";

export async function graphqlRequest(
    query,
    variables = {},
    { signal } = {}
) {
    const token = getToken();

    if (!token) {
        const error = new Error("Bitte melde dich erneut an.");
        error.code = "AUTH_REQUIRED";
        throw error;
    }

    let response;

    try {
        response = await fetch(`${API_BASE_URL}/graphql`, {
            method: "POST",
            headers: {
                "Accept": "application/graphql-response+json, application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ query, variables }),
            cache: "no-store",
            signal
        });
    } catch (error) {
        if (signal?.aborted) {
            throw error;
        }

        throw new Error(
            "Die Verbindung zum Backend ist fehlgeschlagen. "
            + "Bitte versuche es erneut."
        );
    }

    if (response.status === 401) {
        const error = new Error(
            "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an."
        );
        error.code = "AUTH_REQUIRED";
        throw error;
    }

    if (response.status === 403) {
        throw new Error(
            "Der Zugriff wurde verweigert. "
            + "Bitte prüfe deine Anmeldung und Berechtigungen."
        );
    }

    if (!response.ok) {
        throw new Error(
            `Die Anfrage ist fehlgeschlagen (HTTP ${response.status}).`
        );
    }

    const result = await response.json().catch(() => null);

    signal?.throwIfAborted();

    if (!result || typeof result !== "object") {
        throw new Error("Das Backend hat keine gültige Antwort geliefert.");
    }

    if (Array.isArray(result.errors) && result.errors.length > 0) {
        throw new Error(
            result.errors
                .map(error => error.message || "Unbekannter GraphQL-Fehler")
                .join("\n")
        );
    }

    if (!result.data || typeof result.data !== "object") {
        throw new Error("In der Backend-Antwort fehlen die angefragten Daten.");
    }

    return result.data;
}