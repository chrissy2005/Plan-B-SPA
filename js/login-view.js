import { login } from "./auth.js";

export function mountLogin(container, onSuccess) {
    const controller = new AbortController();
    let isSubmitting = false;

    container.innerHTML = `
        <section class="page-card auth-card">
            <h1 tabindex="-1">Plan-B</h1>
            <p class="auth-intro">
                Melde dich an, um deine Projekte zu sehen
            </p>

            <form id="loginForm">
                <div class="auth-row">
                    <label for="loginEmail">E-Mail:</label>
                    <input
                        id="loginEmail"
                        name="email"
                        type="email"
                        autocomplete="username"
                        required
                    >
                </div>

                <div class="auth-row">
                    <label for="loginPassword">Passwort:</label>

                    <div class="password-field">
                        <input
                            id="loginPassword"
                            name="password"
                            type="password"
                            autocomplete="current-password"
                            required
                        >

                        <button
                            id="togglePassword"
                            class="toggle-password"
                            type="button"
                            aria-label="Passwort anzeigen"
                            aria-controls="loginPassword"
                            aria-pressed="false"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <p id="loginError" class="form-error" role="alert"></p>

                <button class="auth-submit" type="submit">
                    Anmelden
                </button>
            </form>

            <p class="auth-register">
                Noch kein Konto?
                <a href="https://plan-b-frontend-1a40950601f6.herokuapp.com/Login/HTML/register.html">
                    Registrieren
                </a>
            </p>
        </section>
    `;

    const form = container.querySelector("#loginForm");
    const emailInput = container.querySelector("#loginEmail");
    const passwordInput = container.querySelector("#loginPassword");
    const errorElement = container.querySelector("#loginError");
    const submitButton = form.querySelector('button[type="submit"]');
    const togglePassword = container.querySelector("#togglePassword");

    function hidePassword() {
        passwordInput.type = "password";
        togglePassword.setAttribute("aria-label", "Passwort anzeigen");
        togglePassword.setAttribute("aria-pressed", "false");
    }

    togglePassword.addEventListener("click", () => {
        const showPassword = passwordInput.type === "password";

        passwordInput.type = showPassword ? "text" : "password";
        togglePassword.setAttribute(
            "aria-label",
            showPassword ? "Passwort verbergen" : "Passwort anzeigen"
        );
        togglePassword.setAttribute(
            "aria-pressed",
            String(showPassword)
        );
    }, { signal: controller.signal });

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
        hidePassword();

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
            hidePassword();
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
        hidePassword();
    };
}