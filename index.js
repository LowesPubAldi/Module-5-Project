const DEFAULT_SEARCH = "hockey";
const INPUT_DEBOUNCE_MS = 500;
const FAVORITES_STORAGE_KEY = "hockey-movies-favorites";
const MOVIE_PROXY_BASE_URL = "/api/movies";

function fallbackGetStartYear(yearText) {
    const matched = String(yearText).match(/^\d{4}/);
    return matched ? Number(matched[0]) : 0;
}

function fallbackFormatMovieYear(yearText) {
    return /[-\u2013]$/.test(String(yearText))
        ? `${String(yearText).trim()} Present`
        : yearText;
}

function fallbackGetSortedMovies(moviesArray, sortValue) {
    const sorted = [...moviesArray];

    if (sortValue === "az") {
        sorted.sort((a, b) => a.Title.localeCompare(b.Title));
    }

    if (sortValue === "za") {
        sorted.sort((a, b) => b.Title.localeCompare(a.Title));
    }

    if (sortValue === "oldest-newest") {
        sorted.sort((a, b) => fallbackGetStartYear(a.Year) - fallbackGetStartYear(b.Year));
    }

    if (sortValue === "newest-oldest") {
        sorted.sort((a, b) => fallbackGetStartYear(b.Year) - fallbackGetStartYear(a.Year));
    }

    return sorted;
}

const movieUtils = window.MovieUtils || {
    getStartYear: fallbackGetStartYear,
    formatMovieYear: fallbackFormatMovieYear,
    getSortedMovies: fallbackGetSortedMovies
};

const {
    getStartYear: utilsGetStartYear,
    formatMovieYear: utilsFormatMovieYear,
    getSortedMovies: utilsGetSortedMovies
} = movieUtils;

function hasRequiredUtils() {
    return typeof utilsGetStartYear === "function"
        && typeof utilsFormatMovieYear === "function"
        && typeof utilsGetSortedMovies === "function";
}

const state = {
    movies: [],
    searchTerm: DEFAULT_SEARCH,
    debounceTimer: null,
    favorites: {},
    activeMovieId: null,
    lastFocusedElement: null,
    currentPage: 1,
    totalResults: 0,
    hasMoreResults: false,
    isLoadingMore: false
};

const elements = {};

function getElements() {
    elements.searchForm = document.querySelector(".search-container form");
    elements.searchBox = document.getElementById("searchBox");
    elements.sortSelect = document.getElementById("sort-options");
    elements.movieList = document.getElementById("movie-list");
    elements.loadingMessage = document.getElementById("loadingMessage");
    elements.errorMessage = document.getElementById("errorMessage");
    elements.noResultsMessage = document.getElementById("noResultsMessage");
    elements.resultsCount = document.getElementById("resultsCount");
    elements.clearButton = document.getElementById("clearButton");
    elements.favoritesList = document.getElementById("favoritesList");
    elements.favoritesEmpty = document.getElementById("favoritesEmpty");
    elements.detailsModal = document.getElementById("detailsModal");
    elements.closeDetailsButton = document.getElementById("closeDetailsButton");
    elements.detailsLoading = document.getElementById("detailsLoading");
    elements.detailsError = document.getElementById("detailsError");
    elements.detailsBody = document.getElementById("detailsBody");
    elements.detailsTitle = document.getElementById("detailsTitle");
    elements.detailsMeta = document.getElementById("detailsMeta");
    elements.detailsGenre = document.getElementById("detailsGenre");
    elements.detailsPlot = document.getElementById("detailsPlot");
    elements.detailsRuntime = document.getElementById("detailsRuntime");
    elements.detailsRating = document.getElementById("detailsRating");
    elements.loadMoreButton = document.getElementById("loadMoreButton");
    elements.paginationStatus = document.getElementById("paginationStatus");
}

function formatDetailText(value, fallback = "Not available") {
    return value && value !== "N/A" ? value : fallback;
}

function setDetailsState({ loading = false, error = false, content = false } = {}) {
    setVisible(elements.detailsLoading, loading);
    setVisible(elements.detailsError, error);

    if (elements.detailsBody) {
        elements.detailsBody.style.display = content ? "block" : "none";
    }
}

function openDetailsModal() {
    if (!elements.detailsModal) {
        return;
    }

    state.lastFocusedElement = document.activeElement;
    elements.detailsModal.classList.add("is-open");
    elements.detailsModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (elements.closeDetailsButton) {
        elements.closeDetailsButton.focus();
    }
}

function closeDetailsModal() {
    if (!elements.detailsModal) {
        return;
    }

    elements.detailsModal.classList.remove("is-open");
    elements.detailsModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    state.activeMovieId = null;

    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === "function") {
        state.lastFocusedElement.focus();
    }
}

function renderMovieDetails(movieDetails) {
    if (!elements.detailsTitle || !elements.detailsMeta) {
        return;
    }

    const title = formatDetailText(movieDetails.Title, "Movie Details");
    const year = formatDetailText(movieDetails.Year);
    const released = formatDetailText(movieDetails.Released);

    elements.detailsTitle.textContent = title;
    elements.detailsMeta.textContent = `${year} | Released: ${released}`;
    elements.detailsGenre.textContent = `Genre: ${formatDetailText(movieDetails.Genre)}`;
    elements.detailsPlot.textContent = `Plot: ${formatDetailText(movieDetails.Plot)}`;
    elements.detailsRuntime.textContent = `Runtime: ${formatDetailText(movieDetails.Runtime)}`;
    elements.detailsRating.textContent = `IMDb Rating: ${formatDetailText(movieDetails.imdbRating)}`;
}

async function showMovieDetails(movie) {
    if (!movie || !movie.imdbID) {
        return;
    }

    state.activeMovieId = movie.imdbID;
    openDetailsModal();
    setDetailsState({ loading: true });

    const detailsUrl = `${MOVIE_PROXY_BASE_URL}?id=${encodeURIComponent(movie.imdbID)}`;

    try {
        const response = await fetch(detailsUrl);

        if (!response.ok) {
            throw new Error("Movie details request failed");
        }

        const details = await response.json();

        if (state.activeMovieId !== movie.imdbID) {
            return;
        }

        if (details.Response === "False") {
            setDetailsState({ error: true });
            return;
        }

        renderMovieDetails(details);
        setDetailsState({ content: true });
    } catch (error) {
        if (state.activeMovieId !== movie.imdbID) {
            return;
        }

        console.error("Could not load movie details:", error);
        setDetailsState({ error: true });
    }
}

function loadFavorites() {
    try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);

        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
        console.error("Could not load favorites:", error);
        return {};
    }
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(state.favorites));
}

function isFavorite(movieId) {
    return Boolean(state.favorites[movieId]);
}

function toggleFavorite(movie) {
    if (!movie || !movie.imdbID) {
        return;
    }

    if (isFavorite(movie.imdbID)) {
        delete state.favorites[movie.imdbID];
    } else {
        state.favorites[movie.imdbID] = {
            imdbID: movie.imdbID,
            Title: movie.Title,
            Year: movie.Year
        };
    }

    saveFavorites();
}

function renderFavorites() {
    if (!elements.favoritesList || !elements.favoritesEmpty) {
        return;
    }

    const favoritesArray = Object.values(state.favorites);
    elements.favoritesList.innerHTML = "";
    elements.favoritesEmpty.style.display = favoritesArray.length ? "none" : "block";

    favoritesArray
        .sort((a, b) => a.Title.localeCompare(b.Title))
        .forEach(movie => {
            const chip = document.createElement("span");
            chip.className = "favorite-chip";
            chip.textContent = `${movie.Title} (${utilsFormatMovieYear(movie.Year)})`;
            elements.favoritesList.appendChild(chip);
        });
}

function setVisible(element, isVisible) {
    if (!element) {
        return;
    }

    element.style.display = isVisible ? "block" : "none";
}

function updateStatus({ loading = false, error = false, noResults = false } = {}) {
    setVisible(elements.loadingMessage, loading);
    setVisible(elements.errorMessage, error);
    setVisible(elements.noResultsMessage, noResults);
}

function updateResultsCount(count, searchTerm) {
    if (!elements.resultsCount) {
        return;
    }

    if (!count) {
        elements.resultsCount.textContent = "";
        return;
    }

    const titleText = count === 1 ? "title" : "titles";
    const totalText = state.totalResults > count ? ` of ${state.totalResults}` : "";
    elements.resultsCount.textContent = `Showing ${count}${totalText} ${titleText} for "${searchTerm}".`;
}

function clearResultsCount() {
    updateResultsCount(0, "");
}

function resetPagination() {
    state.currentPage = 1;
    state.totalResults = 0;
    state.hasMoreResults = false;
    state.isLoadingMore = false;
}

function updatePaginationUi() {
    if (!elements.loadMoreButton || !elements.paginationStatus) {
        return;
    }

    elements.loadMoreButton.style.display = state.hasMoreResults ? "block" : "none";
    elements.loadMoreButton.disabled = state.isLoadingMore;
    elements.loadMoreButton.textContent = state.isLoadingMore ? "Loading..." : "Load More";

    if (state.totalResults > 0) {
        elements.paginationStatus.textContent = `Loaded ${state.movies.length} of ${state.totalResults} results.`;
    } else {
        elements.paginationStatus.textContent = "";
    }
}

function renderMovies(moviesArray) {
    if (!elements.movieList) {
        return;
    }

    elements.movieList.innerHTML = "";

    const fragment = document.createDocumentFragment();

    moviesArray.forEach(movie => {
        const movieCard = document.createElement("div");
        const moviePoster = document.createElement("img");
        const movieTitle = document.createElement("h3");
        const movieYear = document.createElement("p");
        const favoriteButton = document.createElement("button");
        const detailsButton = document.createElement("button");

        movieCard.className = "movie-card";
        moviePoster.className = "movie__poster";
        moviePoster.src = movie.Poster === "N/A" ? "./Assets/no-poster.jpg" : movie.Poster;
        moviePoster.alt = `${movie.Title} poster`;
        moviePoster.addEventListener("error", () => {
            moviePoster.src = "./Assets/no-poster.jpg";
        }, { once: true });

        movieTitle.textContent = movie.Title;
        movieYear.textContent = utilsFormatMovieYear(movie.Year);

        const favoriteState = isFavorite(movie.imdbID);
        favoriteButton.type = "button";
        favoriteButton.className = "favorite-button";
        favoriteButton.setAttribute("aria-pressed", String(favoriteState));
        favoriteButton.textContent = favoriteState ? "Remove Favorite" : "Save Favorite";
        favoriteButton.addEventListener("click", () => {
            toggleFavorite(movie);
            renderCurrentMovies();
            renderFavorites();
        });

        detailsButton.type = "button";
        detailsButton.className = "details-button";
        detailsButton.textContent = "View Details";
        detailsButton.addEventListener("click", () => {
            showMovieDetails(movie);
        });

        movieCard.append(moviePoster, movieTitle, movieYear, favoriteButton, detailsButton);
        fragment.appendChild(movieCard);
    });

    elements.movieList.appendChild(fragment);
}

function renderCurrentMovies() {
    const sortValue = elements.sortSelect ? elements.sortSelect.value : "disabled";
    const sortedMovies = utilsGetSortedMovies(state.movies, sortValue);
    renderMovies(sortedMovies);
}

async function fetchMovies(searchTerm) {
    return fetchMoviesPage(searchTerm, { append: false, page: 1 });
}

async function fetchMoviesPage(searchTerm, { append = false, page = 1 } = {}) {
    const normalizedSearch = searchTerm.trim();

    if (!normalizedSearch) {
        state.movies = [];
        resetPagination();
        renderCurrentMovies();
        updateStatus();
        clearResultsCount();
        updatePaginationUi();
        return;
    }

    state.searchTerm = normalizedSearch;
    state.isLoadingMore = append;

    if (!append) {
        updateStatus({ loading: true });
        clearResultsCount();
    }

    updatePaginationUi();

    const url = `${MOVIE_PROXY_BASE_URL}?search=${encodeURIComponent(normalizedSearch)}&page=${page}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await response.json();

        if (!Array.isArray(data.Search)) {
            if (!append) {
                state.movies = [];
                resetPagination();
                updateStatus({ noResults: true });
                renderCurrentMovies();
            } else {
                state.hasMoreResults = false;
            }

            state.isLoadingMore = false;
            updatePaginationUi();
            return;
        }

        const totalResults = Number(data.totalResults) || data.Search.length;

        if (append) {
            state.movies = [...state.movies, ...data.Search];
        } else {
            state.movies = data.Search;
        }

        state.currentPage = page;
        state.totalResults = totalResults;
        state.hasMoreResults = state.movies.length < state.totalResults;
        state.isLoadingMore = false;

        updateStatus();
        renderCurrentMovies();
        updateResultsCount(state.movies.length, normalizedSearch);
        updatePaginationUi();
    } catch (error) {
        if (!append) {
            state.movies = [];
            resetPagination();
            updateStatus({ error: true });
            renderCurrentMovies();
        } else {
            state.isLoadingMore = false;
            updatePaginationUi();
        }

        console.error("There was a problem with the fetch operation:", error);
    }
}

function queueDebouncedSearch(searchTerm) {
    clearTimeout(state.debounceTimer);

    state.debounceTimer = setTimeout(() => {
        fetchMovies(searchTerm);
    }, INPUT_DEBOUNCE_MS);
}

function handleSubmit(event) {
    event.preventDefault();

    if (!elements.searchBox) {
        return;
    }

    clearTimeout(state.debounceTimer);
    fetchMovies(elements.searchBox.value);
}

function handleInputSearch(event) {
    const searchTerm = event.target.value.trim();

    if (!searchTerm) {
        updateStatus();
        clearResultsCount();
        return;
    }

    if (searchTerm.length < 2) {
        return;
    }

    queueDebouncedSearch(searchTerm);
}

function handleSortChange() {
    renderCurrentMovies();
}

function handleClearSearch() {
    clearTimeout(state.debounceTimer);

    if (elements.searchBox) {
        elements.searchBox.value = "";
        elements.searchBox.focus();
    }

    fetchMovies(DEFAULT_SEARCH);
}

function handleLoadMore() {
    if (!state.searchTerm || !state.hasMoreResults || state.isLoadingMore) {
        return;
    }

    fetchMoviesPage(state.searchTerm, { append: true, page: state.currentPage + 1 });
}

function bindEvents() {
    if (elements.searchForm) {
        elements.searchForm.addEventListener("submit", handleSubmit);
    }

    if (elements.searchBox) {
        elements.searchBox.addEventListener("input", handleInputSearch);
    }

    if (elements.sortSelect) {
        elements.sortSelect.addEventListener("change", handleSortChange);
    }

    if (elements.clearButton) {
        elements.clearButton.addEventListener("click", handleClearSearch);
    }

    if (elements.loadMoreButton) {
        elements.loadMoreButton.addEventListener("click", handleLoadMore);
    }

    if (elements.closeDetailsButton) {
        elements.closeDetailsButton.addEventListener("click", closeDetailsModal);
    }

    if (elements.detailsModal) {
        elements.detailsModal.addEventListener("click", (event) => {
            const target = event.target;

            if (target && target.dataset && target.dataset.closeModal === "true") {
                closeDetailsModal();
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.detailsModal && elements.detailsModal.classList.contains("is-open")) {
            closeDetailsModal();
        }
    });
}

function initializeApp() {
    getElements();

    if (!hasRequiredUtils()) {
        console.error("Movie utility helpers are not available.");
        updateStatus({ error: true });
        return;
    }

    state.favorites = loadFavorites();
    resetPagination();
    bindEvents();

    if (elements.searchBox) {
        elements.searchBox.value = DEFAULT_SEARCH;
    }

    renderFavorites();
    updatePaginationUi();
    fetchMovies(DEFAULT_SEARCH);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    initializeApp();
}