const test = require("node:test");
const assert = require("node:assert/strict");

const {
    getStartYear,
    formatMovieYear,
    getSortedMovies
} = require("../movie-utils.js");

test("getStartYear returns the first valid year", () => {
    assert.equal(getStartYear("2011"), 2011);
    assert.equal(getStartYear("2013-2018"), 2013);
    assert.equal(getStartYear("1999-"), 1999);
});

test("getStartYear returns 0 for invalid values", () => {
    assert.equal(getStartYear("N/A"), 0);
    assert.equal(getStartYear("Unknown"), 0);
    assert.equal(getStartYear(""), 0);
});

test("formatMovieYear adds Present for open-ended ranges", () => {
    assert.equal(formatMovieYear("2013-"), "2013- Present");
    assert.equal(formatMovieYear("2013\u2013"), "2013\u2013 Present");
});

test("formatMovieYear leaves fixed years unchanged", () => {
    assert.equal(formatMovieYear("2006"), "2006");
    assert.equal(formatMovieYear("2012-2014"), "2012-2014");
});

test("getSortedMovies sorts titles ascending and descending", () => {
    const movies = [
        { Title: "Goon", Year: "2011" },
        { Title: "Ice Guardians", Year: "2016" },
        { Title: "Mighty Ducks", Year: "1992" }
    ];

    const az = getSortedMovies(movies, "az").map(movie => movie.Title);
    const za = getSortedMovies(movies, "za").map(movie => movie.Title);

    assert.deepEqual(az, ["Goon", "Ice Guardians", "Mighty Ducks"]);
    assert.deepEqual(za, ["Mighty Ducks", "Ice Guardians", "Goon"]);
});

test("getSortedMovies sorts by oldest and newest start year", () => {
    const movies = [
        { Title: "Future Show", Year: "2020-" },
        { Title: "Retro", Year: "1989" },
        { Title: "Classic", Year: "1994-1999" }
    ];

    const oldest = getSortedMovies(movies, "oldest-newest").map(movie => movie.Title);
    const newest = getSortedMovies(movies, "newest-oldest").map(movie => movie.Title);

    assert.deepEqual(oldest, ["Retro", "Classic", "Future Show"]);
    assert.deepEqual(newest, ["Future Show", "Classic", "Retro"]);
});
