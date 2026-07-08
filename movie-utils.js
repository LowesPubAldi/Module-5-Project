function getStartYear(yearText) {
    const matched = String(yearText).match(/^\d{4}/);
    return matched ? Number(matched[0]) : 0;
}

function formatMovieYear(yearText) {
    return /[-\u2013]$/.test(String(yearText))
        ? `${String(yearText).trim()} Present`
        : yearText;
}

function getSortedMovies(moviesArray, sortValue) {
    const sorted = [...moviesArray];

    if (sortValue === "az") {
        sorted.sort((a, b) => a.Title.localeCompare(b.Title));
    }

    if (sortValue === "za") {
        sorted.sort((a, b) => b.Title.localeCompare(a.Title));
    }

    if (sortValue === "oldest-newest") {
        sorted.sort((a, b) => getStartYear(a.Year) - getStartYear(b.Year));
    }

    if (sortValue === "newest-oldest") {
        sorted.sort((a, b) => getStartYear(b.Year) - getStartYear(a.Year));
    }

    return sorted;
}

if (typeof window !== "undefined") {
    window.MovieUtils = {
        getStartYear,
        formatMovieYear,
        getSortedMovies
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        getStartYear,
        formatMovieYear,
        getSortedMovies
    };
}
