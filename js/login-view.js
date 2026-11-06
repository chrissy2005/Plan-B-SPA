import { login } from "./auth.js";

export function mountLogin(container, onSuccess) {
    const controller = new AbortController();
    let isSubmitting = false;

    container.innerHTML = `
        <section class="page-card auth-card">
            <h1 tabindex="-1">Anmelden</h1>
            <p>Melde dich mit deinem bestehenden Plan-B-Konto an.</p>

            <form id="loginForm">
                <label for="loginEmail">E-Mail-Adresse</label>
                <input
                    id="loginEmail"
                    name="email"
                    type="email"
                    autocomplete="username"
                    required
                >

                <label for="loginPassword">Passwort</label>
                <input
                    id="loginPassword"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    required
                >

                <p id="loginError" class="form-error" role="alert"></p>

                <button type="submit">Anmelden</button>
            </form>
        </section>
    `;

    const form = container.querySelector("#loginForm");
    const emailInput = container.querySelector("#loginEmail");
    const passwordInput = container.querySelector("#loginPassword");
    const errorElement = container.querySelector("#loginError");
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        isSubmitting = true;
        errorElement.textContent = "";
        submitButton.disabled = true;
        submitButton.textContent = "Anmeldung läuft …";
        form.setAttribute("aria-busy", "true");

        try {
            await login(emailInput.value, passwordInput.value, {
                signal: controller.signal
            });

            if (!controller.signal.aborted) {
                onSuccess();
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                errorElement.textContent = error.message;
            }
        } finally {
            passwordInput.value = "";
            isSubmitting = false;

            if (!controller.signal.aborted) {
                submitButton.disabled = false;
                submitButton.textContent = "Anmelden";
                form.removeAttribute("aria-busy");
            }
        }
    }, { signal: controller.signal });

    // Beim Verlassen der Ansicht Anfragen und Listener beenden.
    return () => {
        controller.abort();
        passwordInput.value = "";
    };
}