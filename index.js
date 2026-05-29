// require('dotenv').config();

// const apiKey = process.env.API_KEY;

//const response = await fetch(`http://www.omdbapi.com/?apikey=${apiKey}&t=Jason Statham`);

const api_key = "ea445734";

function fetchMovies(searchTerm) {
    const url = `http://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${api_key}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json(); 
        })
        .then(data => {
            console.log(data.Search); 
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
}

fetchMovies('hockey'); 

// Movie information //

const movies = [
    {
        title: "Hockey Movie 0",
        year: 1995,
        imageUrl: "https://m.media-amazon.com/images/M/MV5BOGExN2Y2NjctNTk1OC00NjdhLWE3MzMtMmYwYmVmZjk0MGI4XkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
        title: "Hockey Movie 1",
        year: 1939,
        imageUrl: "https://m.media-amazon.com/images/M/MV5BZGQwZGZlODctMjI4OC00MjIxLWEwN2YtYTcxMmUwMzI5N2Q0XkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
        title: "Hockey Movie 2",
        year: 2013,
        imageUrl: "https://m.media-amazon.com/images/M/MV5BYzgxMGY0ODUtYmQwZC00ZmFlLTlkZjgtOTFmODNjNDkyZWYwXkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
        title: "Hockey Movie 3",
        year: 2010,
        imageUrl: "https://m.media-amazon.com/images/M/MV5BOTY5NjE2ZTgtN2NkZS00NzAzLWE1NDMtOTY3NTkzNjJmOWI1XkEyXkFqcGdeQXVyNTM0NTU5Mg@@._V1_SX300.jpg"
    },
    {
        title: "Hockey Movie 4",
        year: 1984,
        imageUrl: "https://m.media-amazon.com/images/M/MV5BY2MzYzE5ODgtOTg1NC00ZmFjLTkyNjQtN2Q1MDYzYjhjMjNiXkEyXkFqcGc@._V1_SX300.jpg"
    },
    {
        title: "Hockey Movie 5",
        year: 2001,
        imageUrl: "https://m.media-amazon.com/images/M/MV5BMTc1ODgyNzczMV5BMl5BanBnXkFtZTcwNTgxMjkxMQ@@._V1_SX300.jpg"
    },]

const imageGrid = document.querySelector('.image-grid');

movies.forEach(movie => {
    const movieDiv = document.createElement('div');
    movieDiv.classList.add('movie');

    const img = document.createElement('img');
    img.src = movie.imageUrl;
    img.alt = movie.title;

    const movieInfo = document.createElement('div');
    movieInfo.classList.add('movie-info');
    movieInfo.innerHTML = `<h2>${movie.title}</h2><p>Year: ${movie.year}</p>`;

    movieDiv.appendChild(img);
    movieDiv.appendChild(movieInfo);
    imageGrid.appendChild(movieDiv);
});

console.log(movies.length); // This should log 6 if you have 6 movies