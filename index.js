require('dotenv').config();

const apiKey = process.env.API_KEY;

const response = await fetch(`http://www.omdbapi.com/?apikey=${apiKey}&t=Jason Statham`);

function fetchMovies(searchTerm) {
    const url = `http://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${apiKey}`;

    fetch(url)
        .then(response => {
            if (!response.ok) 
                throw new Error('Network response was not ok');
            }
            return response.json(); 
        })
        .then(data => {
            console.log(data); 
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
}

fetchMovies('hockey');

console.log(apiKey); 