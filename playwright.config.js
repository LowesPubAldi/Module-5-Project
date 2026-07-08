const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./tests/e2e",
    timeout: 30000,
    use: {
        baseURL: "http://127.0.0.1:3000",
        headless: true
    },
    webServer: {
        command: "npm start",
        url: "http://127.0.0.1:3000/health",
        reuseExistingServer: true,
        timeout: 120000
    }
});
