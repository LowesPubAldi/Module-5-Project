const { test, expect } = require("@playwright/test");

async function mockMovieApi(page, { noResultsSearch = null, errorSearch = null } = {}) {
    await page.route("**/api/movies**", async route => {
        const requestUrl = new URL(route.request().url());
        const id = requestUrl.searchParams.get("id");
        const search = requestUrl.searchParams.get("search");
        const pageParam = requestUrl.searchParams.get("page") || "1";

        if (id) {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    Response: "True",
                    Title: "Mock Hockey Story",
                    Year: "2020",
                    Released: "01 Jan 2020",
                    Genre: "Sport",
                    Plot: "A mocked movie details payload for e2e tests.",
                    Runtime: "120 min",
                    imdbRating: "7.7"
                })
            });
            return;
        }

        if (errorSearch && search === errorSearch) {
            await route.fulfill({
                status: 500,
                contentType: "application/json",
                body: JSON.stringify({
                    Response: "False",
                    Error: "Upstream service unavailable"
                })
            });
            return;
        }

        if (noResultsSearch && search === noResultsSearch) {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    Response: "False",
                    Error: "Movie not found!"
                })
            });
            return;
        }

        if (pageParam === "2") {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    Response: "True",
                    totalResults: "12",
                    Search: [
                        { Title: "Page Two One", Year: "2010", imdbID: "tt0002001", Poster: "N/A" },
                        { Title: "Page Two Two", Year: "2011", imdbID: "tt0002002", Poster: "N/A" }
                    ]
                })
            });
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                Response: "True",
                totalResults: "12",
                Search: [
                    { Title: "Page One One", Year: "2001", imdbID: "tt0001001", Poster: "N/A" },
                    { Title: "Page One Two", Year: "2002", imdbID: "tt0001002", Poster: "N/A" },
                    { Title: "Page One Three", Year: "2003", imdbID: "tt0001003", Poster: "N/A" },
                    { Title: "Page One Four", Year: "2004", imdbID: "tt0001004", Poster: "N/A" },
                    { Title: "Page One Five", Year: "2005", imdbID: "tt0001005", Poster: "N/A" },
                    { Title: "Page One Six", Year: "2006", imdbID: "tt0001006", Poster: "N/A" },
                    { Title: "Page One Seven", Year: "2007", imdbID: "tt0001007", Poster: "N/A" },
                    { Title: "Page One Eight", Year: "2008", imdbID: "tt0001008", Poster: "N/A" },
                    { Title: "Page One Nine", Year: "2009", imdbID: "tt0001009", Poster: "N/A" },
                    { Title: "Page One Ten", Year: "2010", imdbID: "tt0001010", Poster: "N/A" }
                ]
            })
        });
    });
}

test("opens movie details modal from a card", async ({ page }) => {
    await mockMovieApi(page);
    await page.goto("/");

    await expect(page.locator("#movie-list .movie-card").first()).toBeVisible({ timeout: 15000 });

    await page.locator("#movie-list .movie-card .details-button").first().click();

    await expect(page.locator("#detailsModal")).toHaveClass(/is-open/);
    await expect(page.locator("#detailsTitle")).not.toHaveText("");

    await page.locator("#closeDetailsButton").click();
    await expect(page.locator("#detailsModal")).not.toHaveClass(/is-open/);
});

test("loads additional pages with Load More", async ({ page }) => {
    await mockMovieApi(page);
    await page.goto("/");

    await page.fill("#searchBox", "star");
    await page.keyboard.press("Enter");

    await expect(page.locator("#movie-list .movie-card").first()).toBeVisible({ timeout: 15000 });

    const firstCount = await page.locator("#movie-list .movie-card").count();

    const loadMoreButton = page.locator("#loadMoreButton");
    await expect(loadMoreButton).toBeVisible({ timeout: 15000 });
    await expect(loadMoreButton).toBeEnabled();

    await loadMoreButton.click();

    await expect.poll(async () => page.locator("#movie-list .movie-card").count(), {
        timeout: 15000
    }).toBeGreaterThan(firstCount);
});

test("shows a no-results message when the API returns no matches", async ({ page }) => {
    await mockMovieApi(page, { noResultsSearch: "empty" });
    await page.goto("/");

    await page.fill("#searchBox", "empty");
    await page.keyboard.press("Enter");

    await expect(page.locator("#noResultsMessage")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#movie-list .movie-card")).toHaveCount(0);
    await expect(page.locator("#errorMessage")).toBeHidden();
});

test("shows an error message when the API request fails", async ({ page }) => {
    await mockMovieApi(page, { errorSearch: "broken" });
    await page.goto("/");

    await page.fill("#searchBox", "broken");
    await page.keyboard.press("Enter");

    await expect(page.locator("#errorMessage")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#movie-list .movie-card")).toHaveCount(0);
    await expect(page.locator("#noResultsMessage")).toBeHidden();
});
