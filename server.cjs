const express = require("express");
const path = require("node:path");

const app = express();
const port = process.env.PORT || 3000;

app.disable("x-powered-by");

// Öffentlich zugängliche Dateien der SPA.
for (const directory of ["css", "js", "icons"]) {
    app.use(
        `/${directory}`,
        express.static(path.join(__dirname, directory), {
            dotfiles: "deny",
            index: false
        })
    );
}

// Einstiegspunkt der Anwendung.
app.get(["/", "/index.html"], (request, response) => {
    response.set("Cache-Control", "no-cache");
    response.sendFile(path.join(__dirname, "index.html"));
});

app.use((request, response) => {
    response.status(404).type("text").send("Nicht gefunden.");
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Plan-B-SPA läuft auf Port ${port}`);
});