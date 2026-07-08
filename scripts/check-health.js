const DEFAULT_HEALTH_URL = "http://localhost:3000/health";
const healthUrl = process.env.HEALTH_URL || DEFAULT_HEALTH_URL;
const requireApiKey = String(process.env.REQUIRE_API_KEY || "false").toLowerCase() === "true";

async function run() {
    try {
        const response = await fetch(healthUrl);

        if (!response.ok) {
            console.error(`Health check failed with status ${response.status}`);
            process.exit(1);
        }

        const body = await response.json();

        if (!body.ok) {
            console.error("Health check response indicates service is not ready.", body);
            process.exit(1);
        }

        if (requireApiKey && !body.hasApiKey) {
            console.error("Health check passed, but API key is missing in runtime environment.");
            process.exit(1);
        }

        console.log(`Health check passed for ${healthUrl}`);
        console.log(JSON.stringify(body));
    } catch (error) {
        console.error("Health check request failed:", error.message);
        process.exit(1);
    }
}

run();
