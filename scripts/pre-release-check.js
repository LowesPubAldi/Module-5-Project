const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm" : "npm";

function runCommand(commandLine, label) {
    return new Promise((resolve, reject) => {
        const child = spawn(commandLine, {
            cwd: root,
            stdio: "inherit",
            env: process.env,
            shell: true
        });

        child.on("error", reject);

        child.on("close", code => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${label} failed with exit code ${code}`));
        });
    });
}

function startServer() {
    const serverProcess = spawn("node", ["server.js"], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env
    });

    const waitForReady = new Promise((resolve, reject) => {
        let settled = false;

        const onData = chunk => {
            const text = chunk.toString();
            process.stdout.write(text);

            if (!settled && text.includes("OMDb proxy running")) {
                settled = true;
                resolve();
            }
        };

        const onError = chunk => {
            process.stderr.write(chunk.toString());
        };

        serverProcess.stdout.on("data", onData);
        serverProcess.stderr.on("data", onError);

        serverProcess.on("error", error => {
            if (!settled) {
                settled = true;
                reject(error);
            }
        });

        serverProcess.on("close", code => {
            if (!settled) {
                settled = true;
                reject(new Error(`Server exited early with code ${code}`));
            }
        });

        setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error("Server did not start within 15 seconds"));
            }
        }, 15000);
    });

    return { serverProcess, waitForReady };
}

async function run() {
    const { serverProcess, waitForReady } = startServer();

    try {
        await waitForReady;
        await runCommand(`${npmCommand} test`, "Unit tests");
        await runCommand(`${npmCommand} run test:e2e`, "E2E tests");
        await runCommand(`${npmCommand} run healthcheck:require-key`, "Health check");
        console.log("Pre-release check passed.");
    } finally {
        if (!serverProcess.killed) {
            serverProcess.kill();
        }
    }
}

run().catch(error => {
    console.error("Pre-release check failed:", error.message);
    process.exit(1);
});
