const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ENV_FILE = path.join(__dirname, "index.env");
const PUBLIC_ROOT = __dirname;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 8000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 180;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".avif": "image/avif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
};

function readEnvFile() {
    try {
        const text = fs.readFileSync(ENV_FILE, "utf8");
        const pairs = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("#"));

        const values = {};

        pairs.forEach(line => {
            const separatorIndex = line.indexOf("=");

            if (separatorIndex <= 0) {
                return;
            }

            const key = line.slice(0, separatorIndex).trim();
            const value = line.slice(separatorIndex + 1).trim();
            values[key] = value;
        });

        return values;
    } catch (error) {
        return {};
    }
}

function parsePositiveInteger(rawValue, fallbackValue) {
    const numericValue = Number(rawValue);

    if (!Number.isInteger(numericValue) || numericValue <= 0) {
        return fallbackValue;
    }

    return numericValue;
}

function buildSecurityHeaders() {
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        "Cross-Origin-Opener-Policy": "same-origin"
    };
}

function buildCorsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
}

function sendJson(response, statusCode, body, extraHeaders = {}) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        ...buildSecurityHeaders(),
        ...buildCorsHeaders(),
        ...extraHeaders
    });

    response.end(JSON.stringify(body));
}

function sendFile(response, filePath) {
    fs.readFile(filePath, (error, content) => {
        if (error) {
            sendJson(response, 404, { error: "File not found" });
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[extension] || "application/octet-stream";

        response.writeHead(200, {
            "Content-Type": contentType,
            ...buildSecurityHeaders()
        });
        response.end(content);
    });
}

function isPathSafe(filePath) {
    const relative = path.relative(PUBLIC_ROOT, filePath);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function handleStaticRequest(url, response) {
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const decodedPath = decodeURIComponent(pathname);
    const normalizedPath = path.normalize(decodedPath).replace(/^([/\\])+/, "");
    const resolvedPath = path.join(PUBLIC_ROOT, normalizedPath);

    if (!isPathSafe(resolvedPath)) {
        sendJson(response, 403, { error: "Forbidden" });
        return;
    }

    fs.stat(resolvedPath, (statError, stats) => {
        if (statError || !stats.isFile()) {
            sendJson(response, 404, { error: "Not found" });
            return;
        }

        sendFile(response, resolvedPath);
    });
}

function sendOptions(response) {
    response.writeHead(204, {
        ...buildCorsHeaders(),
        ...buildSecurityHeaders()
    });
    response.end();
}

function getClientIp(request) {
    const forwardedFor = request.headers["x-forwarded-for"];

    if (typeof forwardedFor === "string" && forwardedFor.trim()) {
        return forwardedFor.split(",")[0].trim();
    }

    return request.socket.remoteAddress || "unknown";
}

function createRateLimiter(windowMs, maxRequests) {
    const buckets = new Map();

    return function consume(ipAddress) {
        const now = Date.now();
        const existing = buckets.get(ipAddress);

        if (!existing || now >= existing.resetAt) {
            const nextBucket = {
                count: 1,
                resetAt: now + windowMs
            };
            buckets.set(ipAddress, nextBucket);

            return {
                allowed: true,
                remaining: Math.max(maxRequests - 1, 0),
                resetAt: nextBucket.resetAt,
                limit: maxRequests
            };
        }

        existing.count += 1;

        if (existing.count > maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: existing.resetAt,
                limit: maxRequests
            };
        }

        return {
            allowed: true,
            remaining: maxRequests - existing.count,
            resetAt: existing.resetAt,
            limit: maxRequests
        };
    };
}

function parsePageValue(rawValue) {
    if (!rawValue) {
        return 1;
    }

    const numericValue = Number(rawValue);

    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 100) {
        return null;
    }

    return numericValue;
}

function isValidImdbId(value) {
    return /^tt\d{7,9}$/.test(value);
}

function validateSearchTerm(value) {
    const trimmed = value.trim();

    if (trimmed.length < 1) {
        return {
            error: "Search query must be at least 1 character.",
            statusCode: 422
        };
    }

    if (trimmed.length > 80) {
        return {
            error: "Search query must be 80 characters or fewer.",
            statusCode: 422
        };
    }

    return {
        value: trimmed
    };
}

function buildOmdbUrl(url, apiKey) {
    const searchParams = url.searchParams;
    const searchTerm = searchParams.get("search");
    const imdbId = searchParams.get("id");
    const pageRaw = searchParams.get("page");
    const pageNumber = parsePageValue(pageRaw);

    if (searchTerm && imdbId) {
        return {
            error: "Provide either search or id, not both.",
            statusCode: 400
        };
    }

    if (!searchTerm && !imdbId) {
        return {
            error: "Provide either search or id query parameter.",
            statusCode: 400
        };
    }

    if (!apiKey) {
        return {
            error: "Missing API key. Add API_KEY to index.env.",
            statusCode: 500
        };
    }

    if (searchTerm) {
        const validatedSearch = validateSearchTerm(searchTerm);

        if (validatedSearch.error) {
            return validatedSearch;
        }

        if (pageNumber === null) {
            return {
                error: "Page must be an integer between 1 and 100.",
                statusCode: 422
            };
        }

        return {
            target: `https://www.omdbapi.com/?s=${encodeURIComponent(validatedSearch.value)}&page=${pageNumber}&apikey=${apiKey}`
        };
    }

    if (imdbId) {
        if (!isValidImdbId(imdbId.trim())) {
            return {
                error: "IMDb id must look like tt1234567.",
                statusCode: 422
            };
        }

        return {
            target: `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId.trim())}&plot=full&apikey=${apiKey}`
        };
    }

    return {
        error: "Invalid request.",
        statusCode: 400
    };
}

async function handleMovieProxy(response, url, options) {
    const { apiKey, fetchImpl, upstreamTimeoutMs } = options;
    const { target, error, statusCode } = buildOmdbUrl(url, apiKey);

    if (error) {
        sendJson(response, statusCode || 400, { error });
        return;
    }

    try {
        const omdbResponse = await fetchImpl(target, {
            signal: AbortSignal.timeout(upstreamTimeoutMs)
        });

        if (!omdbResponse.ok) {
            const mappedStatus = omdbResponse.status >= 500 ? 502 : 500;
            sendJson(response, mappedStatus, {
                error: "OMDb request failed",
                status: omdbResponse.status
            });
            return;
        }

        let body;

        try {
            body = await omdbResponse.json();
        } catch (_parseError) {
            sendJson(response, 502, {
                error: "OMDb response was not valid JSON"
            });
            return;
        }

        sendJson(response, 200, body);
    } catch (fetchError) {
        sendJson(response, 500, {
            error: "Proxy request failed or timed out",
            details: fetchError.message
        });
    }
}

function createAppServer(options = {}) {
    const envValues = readEnvFile();
    const apiKey = options.apiKey || process.env.API_KEY || envValues.API_KEY;
    const fetchImpl = options.fetchImpl || fetch;
    const upstreamTimeoutMs = options.upstreamTimeoutMs || DEFAULT_UPSTREAM_TIMEOUT_MS;
    const rateLimitWindowMs = parsePositiveInteger(
        options.rateLimitWindowMs || process.env.RATE_LIMIT_WINDOW_MS || envValues.RATE_LIMIT_WINDOW_MS,
        DEFAULT_RATE_LIMIT_WINDOW_MS
    );
    const rateLimitMaxRequests = parsePositiveInteger(
        options.rateLimitMaxRequests || process.env.RATE_LIMIT_MAX_REQUESTS || envValues.RATE_LIMIT_MAX_REQUESTS,
        DEFAULT_RATE_LIMIT_MAX_REQUESTS
    );
    const consumeRateLimit = createRateLimiter(rateLimitWindowMs, rateLimitMaxRequests);

    const server = http.createServer((request, response) => {
        const url = new URL(request.url, `http://localhost:${PORT}`);

        if (request.method === "OPTIONS") {
            sendOptions(response);
            return;
        }

        if (request.method === "GET" && url.pathname === "/api/movies") {
            const clientIp = getClientIp(request);
            const rateLimit = consumeRateLimit(clientIp);

            if (!rateLimit.allowed) {
                const retryAfterSeconds = Math.max(Math.ceil((rateLimit.resetAt - Date.now()) / 1000), 1);
                sendJson(response, 429, {
                    error: "Too many requests. Please wait before trying again."
                }, {
                    "Retry-After": String(retryAfterSeconds),
                    "X-RateLimit-Limit": String(rateLimit.limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": String(Math.floor(rateLimit.resetAt / 1000))
                });
                return;
            }

            response.setHeader("X-RateLimit-Limit", String(rateLimit.limit));
            response.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
            response.setHeader("X-RateLimit-Reset", String(Math.floor(rateLimit.resetAt / 1000)));

            handleMovieProxy(response, url, {
                apiKey,
                fetchImpl,
                upstreamTimeoutMs
            });
            return;
        }

        if (request.method === "GET" && url.pathname === "/health") {
            sendJson(response, 200, {
                ok: true,
                hasApiKey: Boolean(apiKey)
            });
            return;
        }

        if (request.method === "GET") {
            handleStaticRequest(url, response);
            return;
        }

        sendJson(response, 404, { error: "Not found" });
    });

    return server;
}

if (require.main === module) {
    const server = createAppServer();
    server.listen(PORT, () => {
        console.log(`OMDb proxy running at http://localhost:${PORT}`);
    });
}

module.exports = {
    createAppServer,
    buildOmdbUrl
};
