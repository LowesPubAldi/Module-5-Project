const api_key = "ea445734";

let movies = [];

function fetchMovies(searchTerm) {
    const loadingMessage = 
        document.getElementById("loadingMessage");

        loadingMessage.style.display = "block";

    const url = `http://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${api_key}`;

    fetch(url) 
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json(); 
        })

        .then(data => {
            loadingMessage.style.display = "none";
            const noResultsMessage = 
            document.getElementById("noResultsMessage");
            if (!data.Search) {
                movies =[];
                noResultsMessage.style.display = "block";
                renderMovies(movies);
                return;
            }

            noResultsMessage.style.display = "none";

            movies = data.Search;
            renderMovies(movies);
        })
            .catch(error => {
                loadingMessage.style.display = "none";
                console.error ("There was a problem with the fetch operation:", error);
            });}

function renderMovies(moviesArray) {
    const movieList = document.getElementById("movie-list");

    movieList.innerHTML ="";

    moviesArray.forEach(movie => {
        movieList.innerHTML += `
        <div class="movie-card">
                <img class="movie__poster" 
                src="${movie.Poster === 'N/A' ?
                "./Assets/no-poster.jpg" : movie.Poster}" 
                alt="${movie.Title}">
                <h3>${movie.Title}</h3>
                <p>${movie.Year}</p>
                </div>
                `;
                });

            const posterImages = document.querySelectorAll(".movie__poster");

            posterImages.forEach(img => {
                img.addEventListener("error", () => {
                    img.src = "./Assets/no-poster.jpg";
                }, { once: true });
            });}

fetchMovies('hockey'); 

/* Sorting Functionality */

const sortSelect = document.getElementById("sort-options");

sortSelect.addEventListener("change", () => {

    if(sortSelect.value === "disabled") {
        return;
    }

    if(sortSelect.value === "az") {
        movies.sort((a, b) => a.Title.localeCompare(b.Title));
        renderMovies(movies);
    }

    if(sortSelect.value === "za") {
        movies.sort((a, b) => b.Title.localeCompare(a.Title));
        renderMovies(movies);
    }

    if(sortSelect.value === "oldest-newest") {
        movies.sort((a, b) => Number(a.Year) - Number(b.Year));
        renderMovies(movies);
    }

    if(sortSelect.value === "newest-oldest") {
        movies.sort((a, b) => Number(b.Year) - Number(a.Year));
        renderMovies(movies);
    }
    });

/* Search Box Functionality */

const searchForm = document.querySelector("form");
const searchBox = document.getElementById("searchBox");

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const searchTerm = searchBox.value.trim();

    if (searchTerm === "") {
        return;
    }
    fetchMovies(searchTerm);
})
