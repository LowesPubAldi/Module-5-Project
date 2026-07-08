const test = require("node:test");
const assert = require("node:assert/strict");

const { createAppServer } = require("../server.js");

async function startTestServer(options = {}) {
    const server = createAppServer(options);

    await new Promise(resolve => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    return {
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
    };
}

async function stopTestServer(server) {
    await new Promise((resolve, reject) => {
        server.close(error => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

test("/api/movies rejects missing query params", async () => {
    const { server, baseUrl } = await startTestServer({
        apiKey: "test-key",
        fetchImpl: async () => {
            throw new Error("Should not call upstream");
        }
    });

    try {
        const response = await fetch(`${baseUrl}/api/movies`);
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.error, "Provide either search or id query parameter.");
    } finally {
        await stopTestServer(server);
    }
});

test("/api/movies rejects invalid imdb id", async () => {
    const { server, baseUrl } = await startTestServer({
        apiKey: "test-key",
        fetchImpl: async () => {
            throw new Error("Should not call upstream");
        }
    });

    try {
        const response = await fetch(`${baseUrl}/api/movies?id=bad-id`);
        const body = await response.json();

        assert.equal(response.status, 422);
        assert.equal(body.error, "IMDb id must look like tt1234567.");
    } finally {
        await stopTestServer(server);
    }
});

test("/api/movies forwards valid search and page to upstream", async () => {
    let capturedUrl = "";

    const { server, baseUrl } = await startTestServer({
        apiKey: "test-key",
        fetchImpl: async targetUrl => {
            capturedUrl = targetUrl;

            return new Response(
                JSON.stringify({
                    Response: "True",
                    Search: [{ Title: "Mock Title", Year: "2001", imdbID: "tt1234567", Poster: "N/A" }],
                    totalResults: "1"
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }
    });

    try {
        const response = await fetch(`${baseUrl}/api/movies?search=hockey&page=2`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.Response, "True");
        assert.match(capturedUrl, /s=hockey/);
        assert.match(capturedUrl, /page=2/);
        assert.match(capturedUrl, /apikey=test-key/);
    } finally {
        await stopTestServer(server);
    }
});

test("/api/movies maps upstream 503 to 502", async () => {
    const { server, baseUrl } = await startTestServer({
        apiKey: "test-key",
        fetchImpl: async () => new Response("downstream unavailable", { status: 503 })
    });

    try {
        const response = await fetch(`${baseUrl}/api/movies?search=hockey`);
        const body = await response.json();

        assert.equal(response.status, 502);
        assert.equal(body.error, "OMDb request failed");
        assert.equal(body.status, 503);
    } finally {
        await stopTestServer(server);
    }
});

test("/health returns security headers", async () => {
    const { server, baseUrl } = await startTestServer({
        apiKey: "test-key"
    });

    try {
        const response = await fetch(`${baseUrl}/health`);

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.equal(response.headers.get("x-frame-options"), "DENY");
    } finally {
        await stopTestServer(server);
    }
});

test("/api/movies enforces rate limiting", async () => {
    const { server, baseUrl } = await startTestServer({
        apiKey: "test-key",
        rateLimitMaxRequests: 1,
        rateLimitWindowMs: 60000,
        fetchImpl: async () => {
            return new Response(
                JSON.stringify({
                    Response: "True",
                    Search: [{ Title: "Mock", Year: "2000", imdbID: "tt1234567", Poster: "N/A" }],
                    totalResults: "1"
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }
    });

    try {
        const firstResponse = await fetch(`${baseUrl}/api/movies?search=hockey`);
        const secondResponse = await fetch(`${baseUrl}/api/movies?search=hockey`);
        const secondBody = await secondResponse.json();

        assert.equal(firstResponse.status, 200);
        assert.equal(secondResponse.status, 429);
        assert.equal(secondBody.error, "Too many requests. Please wait before trying again.");
        assert.equal(secondResponse.headers.get("x-ratelimit-limit"), "1");
    } finally {
        await stopTestServer(server);
    }
});
