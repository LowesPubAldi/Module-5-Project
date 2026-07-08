const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const changelogPath = path.join(root, "CHANGELOG.md");
const packageJsonPath = path.join(root, "package.json");

function readPackageVersion() {
    const raw = fs.readFileSync(packageJsonPath, "utf8");
    return JSON.parse(raw).version;
}

function safeExec(command) {
    try {
        return execSync(command, {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"]
        }).trim();
    } catch (_error) {
        return "";
    }
}

function getCommitLines() {
    const latestTag = safeExec("git describe --tags --abbrev=0");
    const logCommand = latestTag
        ? `git log ${latestTag}..HEAD --pretty=format:%s`
        : "git log -n 20 --pretty=format:%s";

    const lines = safeExec(logCommand)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        return ["Maintenance release."];
    }

    return lines;
}

function readExistingChangelog() {
    try {
        return fs.readFileSync(changelogPath, "utf8");
    } catch (_error) {
        return "# Changelog\n\nAll notable changes to this project are documented in this file.\n\n";
    }
}

function stripHeaderBlocks(text) {
    return text.replace(/# Changelog\s+All notable changes to this project are documented in this file\.\s*/g, "").trimStart();
}

function stripVersionEntry(text, version) {
    const entryPattern = new RegExp(`## v${version} - [\\s\\S]*?(?=\\n## v|$)`, "g");
    return text.replace(entryPattern, "").trimStart();
}

function buildEntry(version, commitLines) {
    const date = new Date().toISOString().slice(0, 10);
    const bullets = commitLines.map(line => `- ${line}`).join("\n");

    return `## v${version} - ${date}\n${bullets}\n\n`;
}

function run() {
    const version = readPackageVersion();
    const commits = getCommitLines();
    const existing = readExistingChangelog();
    const header = "# Changelog\n\nAll notable changes to this project are documented in this file.\n\n";
    const existingWithoutHeader = stripVersionEntry(stripHeaderBlocks(existing), version);

    const nextContent = `${header}${buildEntry(version, commits)}${existingWithoutHeader}`;
    fs.writeFileSync(changelogPath, nextContent, "utf8");
    console.log(`Updated CHANGELOG.md for v${version}`);
}

run();
