const DEFAULT_SEARCH = "batman";
const INPUT_DEBOUNCE_MS = 500;
const FAVORITES_STORAGE_KEY = "titlescope-favorites";
const LEGACY_FAVORITES_STORAGE_KEY = "hockey-movies-favorites";
const MOVIE_PROXY_BASE_URL = "/api/movies";
const DEFAULT_NO_RESULTS_MESSAGE = "No results matching your search.";
const DEFAULT_ERROR_MESSAGE = "We could not load titles right now. Please try again.";
const DEFAULT_FOCUS_HEADING = "Movies";
const DEFAULT_FOCUS_INTRO = "Individual title view with the details people care about most.";
const FALLBACK_MOVIES = [
    {
        imdbID: "fallback-1",
        Title: "Miracle",
        Year: "2004",
        Poster: "N/A"
    },
    {
        imdbID: "fallback-2",
        Title: "The Mighty Ducks",
        Year: "1992",
        Poster: "N/A"
    },
    {
        imdbID: "fallback-3",
        Title: "Goon",
        Year: "2011",
        Poster: "N/A"
    },
    {
        imdbID: "fallback-4",
        Title: "Slap Shot",
        Year: "1977",
        Poster: "N/A"
    },
    {
        imdbID: "fallback-5",
        Title: "Ice Guardians",
        Year: "2016",
        Poster: "N/A"
    }
];

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
    castByMovieId: {},
    activeMovieId: null,
    lastFocusedElement: null,
    currentPage: 1,
    totalResults: 0,
    hasMoreResults: false,
    isLoadingMore: false,
    moviesFocusDetails: null,
    moviesFocusCastExpanded: false,
    activeProxyBase: null
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
    elements.moviesFocusEmpty = document.getElementById("moviesFocusEmpty");
    elements.moviesFocusBody = document.getElementById("moviesFocusBody");
    elements.moviesFocusTitle = document.getElementById("moviesFocusTitle");
    elements.focusRuntime = document.getElementById("focusRuntime");
    elements.focusGenre = document.getElementById("focusGenre");
    elements.focusRatingVotes = document.getElementById("focusRatingVotes");
    elements.focusRelease = document.getElementById("focusRelease");
    elements.focusCreators = document.getElementById("focusCreators");
    elements.focusTopCast = document.getElementById("focusTopCast");
    elements.focusCastToggle = document.getElementById("focusCastToggle");
    elements.focusFullCast = document.getElementById("focusFullCast");
    elements.focusPlot = document.getElementById("focusPlot");
}

function formatDetailText(value, fallback = "Not available") {
    return value && value !== "N/A" ? value : fallback;
}

function formatMediaType(value, fallback = "Title") {
    if (!value || value === "N/A") {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();

    if (normalized === "movie") {
        return "Movie";
    }

    if (normalized === "series") {
        return "Series";
    }

    if (normalized === "game") {
        return "Game";
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getMediaTypeConfig(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized === "game") {
        return {
            label: "Game",
            heading: "Games",
            intro: "Individual game view with the details people care about most.",
            iconClass: "fa-solid fa-gamepad"
        };
    }

    if (normalized === "series") {
        return {
            label: "Series",
            heading: "Series",
            intro: "Individual series view with the details people care about most.",
            iconClass: "fa-solid fa-tv"
        };
    }

    return {
        label: "Movie",
        heading: "Movies",
        intro: "Individual movie view with the details people care about most.",
        iconClass: "fa-solid fa-clapperboard"
    };
}

function setMoviesFocusContext(typeValue) {
    const typeConfig = getMediaTypeConfig(typeValue);
    const headingElement = document.getElementById("moviesFocusHeading");
    const introElement = document.getElementById("moviesFocusIntro");

    if (headingElement) {
        headingElement.textContent = typeConfig.heading || DEFAULT_FOCUS_HEADING;
    }

    if (introElement) {
        introElement.textContent = typeConfig.intro || DEFAULT_FOCUS_INTRO;
    }
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
    const mediaType = formatMediaType(movieDetails.Type);

    elements.detailsTitle.textContent = title;
    elements.detailsMeta.textContent = `${year} | Type: ${mediaType} | Released: ${released}`;
    elements.detailsGenre.textContent = `Genre: ${formatDetailText(movieDetails.Genre)}`;
    elements.detailsPlot.textContent = `Plot: ${formatDetailText(movieDetails.Plot)}`;
    elements.detailsRuntime.textContent = `Runtime: ${formatDetailText(movieDetails.Runtime)}`;
    elements.detailsRating.textContent = `IMDb Rating: ${formatDetailText(movieDetails.imdbRating)}`;
}

function formatCastList(actorsText, count) {
    if (!actorsText || actorsText === "N/A") {
        return "Not available";
    }

    const cast = actorsText
        .split(",")
        .map(name => name.trim())
        .filter(Boolean);

    if (!cast.length) {
        return "Not available";
    }

    return cast.slice(0, count).join(", ");
}

function renderMoviesFocusPanel() {
    if (!elements.moviesFocusBody || !elements.moviesFocusEmpty) {
        return;
    }

    const details = state.moviesFocusDetails;

    if (!details) {
        setMoviesFocusContext();
        elements.moviesFocusBody.style.display = "none";
        elements.moviesFocusEmpty.style.display = "block";
        return;
    }

    const rating = formatDetailText(details.imdbRating);
    const votes = formatDetailText(details.imdbVotes);
    const mediaType = formatMediaType(details.Type);
    const topCast = formatCastList(details.Actors, 3);
    const fullCast = formatCastList(details.Actors, Number.POSITIVE_INFINITY);

    elements.moviesFocusTitle.textContent = formatDetailText(details.Title, "Movie");
    setMoviesFocusContext(details.Type);
    elements.focusRuntime.textContent = formatDetailText(details.Runtime);
    elements.focusGenre.textContent = formatDetailText(details.Genre);
    elements.focusRatingVotes.textContent = `${rating} (${votes} votes)`;
    elements.focusRelease.textContent = `${mediaType} | ${formatDetailText(details.Year)} | ${formatDetailText(details.Released)}`;
    elements.focusCreators.textContent = `${formatDetailText(details.Director)} | ${formatDetailText(details.Writer)}`;
    elements.focusTopCast.textContent = topCast;
    elements.focusFullCast.textContent = fullCast;
    elements.focusPlot.textContent = formatDetailText(details.Plot);

    const hasCast = fullCast !== "Not available";
    if (elements.focusCastToggle) {
        elements.focusCastToggle.style.display = hasCast ? "inline-flex" : "none";
        elements.focusCastToggle.setAttribute("aria-expanded", String(state.moviesFocusCastExpanded));
        elements.focusCastToggle.textContent = state.moviesFocusCastExpanded ? "Hide Full Cast" : "Show Full Cast";
    }

    if (elements.focusFullCast) {
        elements.focusFullCast.style.display = state.moviesFocusCastExpanded ? "block" : "none";
    }

    elements.moviesFocusEmpty.style.display = "none";
    elements.moviesFocusBody.style.display = "block";
}

function setMoviesFocusDetails(details) {
    state.moviesFocusDetails = details;
    state.moviesFocusCastExpanded = false;
    renderMoviesFocusPanel();
}

function setMoviesFocusMessage(messageText) {
    if (!elements.moviesFocusEmpty) {
        return;
    }

    elements.moviesFocusEmpty.textContent = messageText;
}

function setMoviesFocusLoading() {
    if (elements.moviesFocusBody) {
        elements.moviesFocusBody.style.display = "none";
    }

    setMoviesFocusMessage("Loading selected movie...");

    if (elements.moviesFocusEmpty) {
        elements.moviesFocusEmpty.style.display = "block";
    }
}

function setMoviesFocusError(messageText) {
    if (elements.moviesFocusBody) {
        elements.moviesFocusBody.style.display = "none";
    }

    setMoviesFocusMessage(messageText);

    if (elements.moviesFocusEmpty) {
        elements.moviesFocusEmpty.style.display = "block";
    }
}

function routeToMovie(imdbId) {
    if (!/^tt\d{7,9}$/.test(String(imdbId))) {
        return;
    }

    const nextHash = `#movie/${imdbId}`;

    if (window.location.hash === nextHash) {
        handleRouteChange();
        return;
    }

    window.location.hash = nextHash;
}

async function handleRouteChange() {
    const hashValue = window.location.hash.replace(/^#/, "");

    if (hashValue === "movie") {
        if (state.moviesFocusDetails) {
            document.getElementById("moviesSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }

        const firstMovie = state.movies.find(movie => /^tt\d{7,9}$/.test(String(movie.imdbID)));

        if (firstMovie) {
            routeToMovie(firstMovie.imdbID);
            return;
        }

        setMoviesFocusError("Search for a movie, then open one from the results.");
        return;
    }

    if (!hashValue.startsWith("movie/")) {
        return;
    }

    const imdbId = hashValue.replace("movie/", "").trim();

    if (!/^tt\d{7,9}$/.test(imdbId)) {
        setMoviesFocusError("This movie route is invalid. Choose a movie from search results.");
        return;
    }

    setMoviesFocusLoading();

    try {
        const details = await fetchMovieDetailsById(imdbId);

        if (details.Response === "False") {
            setMoviesFocusError("Could not load this movie right now. Try another title.");
            return;
        }

        setMoviesFocusDetails(details);
        document.getElementById("moviesSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        console.error("Could not load route movie details:", error);
        setMoviesFocusError("Could not load this movie route right now.");
    }
}

async function fetchMovieDetailsById(imdbId) {
    return fetchFromProxy({ id: imdbId });
}

async function showMovieDetails(movie) {
    if (!movie || !movie.imdbID) {
        return;
    }

    state.activeMovieId = movie.imdbID;
    openDetailsModal();
    setDetailsState({ loading: true });

    try {
        const details = await fetchMovieDetailsById(movie.imdbID);

        if (state.activeMovieId !== movie.imdbID) {
            return;
        }

        if (details.Response === "False") {
            setDetailsState({ error: true });
            return;
        }

        setMoviesFocusDetails(details);
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
        let raw = localStorage.getItem(FAVORITES_STORAGE_KEY);

        if (!raw) {
            raw = localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY);

            if (raw) {
                localStorage.setItem(FAVORITES_STORAGE_KEY, raw);
            }
        }

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

function getFallbackMovies(searchTerm) {
    const normalized = searchTerm.toLowerCase();
    return FALLBACK_MOVIES.filter(movie => {
        return movie.Title.toLowerCase().includes(normalized);
    });
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

function setNoResultsMessage(messageText = DEFAULT_NO_RESULTS_MESSAGE) {
    if (!elements.noResultsMessage) {
        return;
    }

    elements.noResultsMessage.textContent = messageText;
}

function setErrorMessage(messageText = DEFAULT_ERROR_MESSAGE) {
    if (!elements.errorMessage) {
        return;
    }

    elements.errorMessage.textContent = messageText;
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

function getProxyBaseCandidates() {
    const baseCandidates = [MOVIE_PROXY_BASE_URL];

    if (state.activeProxyBase && baseCandidates.includes(state.activeProxyBase)) {
        return [
            state.activeProxyBase,
            ...baseCandidates.filter(baseUrl => baseUrl !== state.activeProxyBase)
        ];
    }

    return baseCandidates;
}

function buildProxyUrl(baseUrl, params) {
    const searchParams = new URLSearchParams(params);
    return `${baseUrl}?${searchParams.toString()}`;
}

async function fetchFromProxy(params) {
    let lastError = null;

    for (const baseUrl of getProxyBaseCandidates()) {
        const requestUrl = buildProxyUrl(baseUrl, params);

        try {
            const response = await fetch(requestUrl);

            if (!response.ok) {
                let errorMessage = `Proxy request failed with status ${response.status}`;

                try {
                    const body = await response.json();

                    if (body && typeof body.error === "string" && body.error.trim()) {
                        errorMessage = body.error.trim();
                    }
                } catch (_bodyError) {
                    // Use default status-based message when response body is not JSON.
                }

                lastError = new Error(errorMessage);
                continue;
            }

            if (state.activeProxyBase !== baseUrl) {
                state.activeProxyBase = baseUrl;
                console.info(`Using API proxy base: ${baseUrl}`);
            }

            return response.json();
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("Proxy request failed");
}

function hideAllCastPreviews(exceptElement = null) {
    document.querySelectorAll(".movie-cast-tooltip.is-visible").forEach(tooltip => {
        if (tooltip === exceptElement) {
            return;
        }

        tooltip.classList.remove("is-visible", "is-touch");
        tooltip.style.opacity = "0";
        tooltip.style.visibility = "hidden";
    });
}

function renderMovies(moviesArray) {
    if (!elements.movieList) {
        return;
    }

    elements.movieList.innerHTML = "";

    const fragment = document.createDocumentFragment();

    const isTouchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;

    moviesArray.forEach(movie => {
        const movieCard = document.createElement("div");
        const moviePoster = document.createElement("img");
        const movieTitle = document.createElement("h3");
        const movieYearRow = document.createElement("div");
        const movieYear = document.createElement("p");
        const movieTypeBadge = document.createElement("span");
        const castTooltip = document.createElement("p");
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
    movieYearRow.className = "movie-year-row";
    movieYear.className = "movie-year";
        movieYear.textContent = utilsFormatMovieYear(movie.Year);
    movieTypeBadge.className = "movie-type-badge";
    const typeConfig = getMediaTypeConfig(movie.Type);
    movieTypeBadge.innerHTML = `<i class="${typeConfig.iconClass}" aria-hidden="true"></i><span class="sr-only">${typeConfig.label}</span>`;
    movieTypeBadge.setAttribute("aria-label", `Type: ${typeConfig.label}`);
    movieTypeBadge.setAttribute("title", typeConfig.label);
    movieYearRow.append(movieYear, movieTypeBadge);

        castTooltip.className = "movie-cast-tooltip";
        castTooltip.textContent = isTouchDevice ? "Top Cast: Tap poster" : "Top Cast: Hover to load";

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
            routeToMovie(movie.imdbID);
        });

        const showCastPreview = (event) => {
            loadMovieCast(movie, castTooltip);
            positionCastTooltip(castTooltip, movieCard, event);
            hideAllCastPreviews(castTooltip);
            castTooltip.classList.add("is-visible");
            castTooltip.style.opacity = "1";
            castTooltip.style.visibility = "visible";
        };

        const moveCastPreview = (event) => {
            positionCastTooltip(castTooltip, movieCard, event);
        };

        const hideCastPreview = () => {
            castTooltip.classList.remove("is-visible", "is-touch");
            castTooltip.style.opacity = "0";
            castTooltip.style.visibility = "hidden";
        };

        moviePoster.addEventListener("mouseenter", showCastPreview);
        moviePoster.addEventListener("mousemove", moveCastPreview);
        moviePoster.addEventListener("mouseleave", hideCastPreview);
        moviePoster.addEventListener("click", event => {
            if (!isTouchDevice) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const isVisible = castTooltip.classList.contains("is-visible");
            hideAllCastPreviews();

            if (isVisible) {
                return;
            }

            loadMovieCast(movie, castTooltip);
            castTooltip.classList.add("is-visible", "is-touch");
            castTooltip.style.opacity = "1";
            castTooltip.style.visibility = "visible";
        });

        movieCard.append(moviePoster, movieTitle, movieYearRow, favoriteButton, detailsButton, castTooltip);
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
        setNoResultsMessage();
        updatePaginationUi();
        return;
    }

    state.searchTerm = normalizedSearch;
    state.isLoadingMore = append;

    if (!append) {
        updateStatus({ loading: true });
        clearResultsCount();
        setErrorMessage();
    }

    updatePaginationUi();

    try {
        const data = await fetchFromProxy({ search: normalizedSearch, page });

        if (!Array.isArray(data.Search)) {
            if (!append) {
                const tooManyResults = typeof data.Error === "string"
                    && data.Error.toLowerCase().includes("too many results");

                state.movies = [];
                resetPagination();
                setNoResultsMessage(
                    tooManyResults
                        ? `Too many matches for "${normalizedSearch}". Add one more character.`
                        : DEFAULT_NO_RESULTS_MESSAGE
                );
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

        setNoResultsMessage();
        updateStatus();
        renderCurrentMovies();
        updateResultsCount(state.movies.length, normalizedSearch);
        updatePaginationUi();
    } catch (error) {
        if (!append) {
            const fallbackMovies = getFallbackMovies(normalizedSearch);
            state.movies = fallbackMovies;
            resetPagination();
            state.totalResults = fallbackMovies.length;
            setNoResultsMessage();
            setErrorMessage(error.message || DEFAULT_ERROR_MESSAGE);
            updateStatus({ error: true, noResults: fallbackMovies.length === 0 });
            renderCurrentMovies();
            updateResultsCount(state.movies.length, normalizedSearch);
            updatePaginationUi();
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

    if (elements.focusCastToggle) {
        elements.focusCastToggle.addEventListener("click", () => {
            state.moviesFocusCastExpanded = !state.moviesFocusCastExpanded;
            renderMoviesFocusPanel();
        });
    }

    window.addEventListener("hashchange", () => {
        handleRouteChange();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.detailsModal && elements.detailsModal.classList.contains("is-open")) {
            closeDetailsModal();
        }
    });

    document.addEventListener("click", event => {
        const target = event.target;

        if (!(target instanceof Element) || target.closest(".movie-card")) {
            return;
        }

        hideAllCastPreviews();
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
    renderMoviesFocusPanel();
    updatePaginationUi();
    fetchMovies(DEFAULT_SEARCH);
    handleRouteChange();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    initializeApp();
}

function formatTopCast(actorsText) {
    if (!actorsText || actorsText === "N/A") {
        return "Top Cast: Not available";
    }

    const topCast = actorsText
        .split(",")
        .map(name => name.trim())
        .filter(Boolean)
        .slice(0, 3);

    if (!topCast.length) {
        return "Top Cast: Not available";
    }

    return `Top Cast: ${topCast.join(", ")}`;
}

async function loadMovieCast(movie, tooltipElement) {
    if (!movie || !movie.imdbID || !tooltipElement) {
        return;
    }

    if (state.castByMovieId[movie.imdbID]) {
        tooltipElement.textContent = state.castByMovieId[movie.imdbID];
        return;
    }

    if (!/^tt\d{7,9}$/.test(movie.imdbID)) {
        const fallbackText = "Top Cast: Not available";
        state.castByMovieId[movie.imdbID] = fallbackText;
        tooltipElement.textContent = fallbackText;
        return;
    }

    tooltipElement.textContent = "Top Cast: Loading...";

    try {
        const details = await fetchFromProxy({ id: movie.imdbID });
        const castText = formatTopCast(details.Actors);
        state.castByMovieId[movie.imdbID] = castText;
        tooltipElement.textContent = castText;
    } catch (error) {
        console.error("Could not load movie cast:", error);
        const fallbackText = "Top Cast: Not available";
        state.castByMovieId[movie.imdbID] = fallbackText;
        tooltipElement.textContent = fallbackText;
    }
}

function positionCastTooltip(tooltipElement, cardElement, event) {
    if (!tooltipElement || !cardElement || !event) {
        return;
    }

    const cardRect = cardElement.getBoundingClientRect();
    const xOffset = event.clientX - cardRect.left + 12;
    const yOffset = event.clientY - cardRect.top + 12;

    const maxX = cardRect.width - 10;
    const maxY = cardRect.height - 10;
    const nextX = Math.max(10, Math.min(xOffset, maxX));
    const nextY = Math.max(10, Math.min(yOffset, maxY));

    tooltipElement.style.left = `${nextX}px`;
    tooltipElement.style.top = `${nextY}px`;
}