module.exports = async function handler(request, response) {
    const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
    const imdbId = typeof request.query.id === "string" ? request.query.id.trim() : "";
    const pageRaw = typeof request.query.page === "string" ? request.query.page.trim() : "1";
    const page = Number(pageRaw);
    const apiKey = process.env.API_KEY;

    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
        response.status(204).end();
        return;
    }

    if (!apiKey) {
        response.status(500).json({ error: "Missing API key in deployment environment." });
        return;
    }

    if (search && imdbId) {
        response.status(400).json({ error: "Provide either search or id, not both." });
        return;
    }

    if (!search && !imdbId) {
        response.status(400).json({ error: "Provide either search or id query parameter." });
        return;
    }

    try {
        let targetUrl = "";

        if (search) {
            if (search.length < 1) {
                response.status(422).json({ error: "Search query must be at least 1 character." });
                return;
            }

            if (search.length > 80) {
                response.status(422).json({ error: "Search query must be 80 characters or fewer." });
                return;
            }

            if (!Number.isInteger(page) || page < 1 || page > 100) {
                response.status(422).json({ error: "Page must be an integer between 1 and 100." });
                return;
            }

            targetUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(search)}&page=${page}&apikey=${apiKey}`;
        }

        if (imdbId) {
            if (!/^tt\d{7,9}$/.test(imdbId)) {
                response.status(422).json({ error: "IMDb id must look like tt1234567." });
                return;
            }

            targetUrl = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&plot=full&apikey=${apiKey}`;
        }

        const upstreamResponse = await fetch(targetUrl);

        if (!upstreamResponse.ok) {
            const mappedStatus = upstreamResponse.status >= 500 ? 502 : 500;
            response.status(mappedStatus).json({
                error: "OMDb request failed",
                status: upstreamResponse.status
            });
            return;
        }

        const data = await upstreamResponse.json();
        response.status(200).json(data);
    } catch (_error) {
        response.status(502).json({ error: "Failed to reach OMDb service." });
    }
};
