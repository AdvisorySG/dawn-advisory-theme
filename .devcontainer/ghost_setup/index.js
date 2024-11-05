const readline = require("readline");
const GhostAdminAPI = require("@tryghost/admin-api");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
});

console.log("---");
console.log("Please do the following steps:");
console.log("Step 1: Complete the setup at http://localhost:2368/ghost/.");
console.log(
    "The actual details don't matter, but make sure to save your username and password.",
);
console.log(
    "Step 2: Follow https://ghost.org/docs/admin-api/#token-authentication to create an integration.",
);
console.log("Step 3: Copy the Admin API key into the following prompt.");
console.log("---");

(async () => {
    const apiKey = await new Promise((callback) => {
        rl.question("Admin API Key: ", callback);
    });

    const api = new GhostAdminAPI({
        url: "http://localhost:2368",
        version: "v5.0",
        key: apiKey,
    });

    console.log("Activating repository theme...");
    await api.themes.activate("dawn-advisory-theme").then((res) => {
        console.log(JSON.stringify(res));
    });
    console.log("Finished setup!");

    console.log("---");
    console.log("The remaining steps need to be done manually:");
    console.log(
        "1. Under Settings > Advanced > Import/Export, import an export of the main Ghost website.",
    );
    console.log("2. Under Settings > Labs, import redirects and routes.");
    console.log("For more details, please reach out to the maintainers! :)");
    console.log("---");

    await new Promise((callback) => {
        rl.question("Press enter to continue...", callback);
    });
    rl.close();
})();
