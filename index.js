// Sort Z to A//
document.getElementById('sortOptions').addEventListener('change', function() {
    const sortingMethod = this.value;
    const gallery = document.querySelector('.gallery');
    const cards = Array.from(gallery.children);

    if (sortingMethod === 'oldest') {
        cards.sort((a, b) => {
            return a.getAttribute('data-year') - b.getAttribute('data-year');
        });
    } else if (sortingMethod === 'newest') {
        cards.sort((a, b) => {
            return b.getAttribute('data-year') - a.getAttribute('data-year');
        });
    } else if (sortingMethod === 'za') {
        cards.sort((a, b) => {
            return b.querySelector('h2').innerText.localeCompare(a.querySelector('h2').innerText);
        });
    }

    // Clear the gallery and append sorted cards
    gallery.innerHTML = '';
    cards.forEach(card => gallery.appendChild(card));
});

// Select the search box and gallery
const searchBox = document.getElementById('searchBox');
const gallery = document.querySelector('.gallery');
const cards = document.querySelectorAll('.card'); // Assuming all your cards are under .gallery
const noResultsMessage = document.createElement('p'); // Create a paragraph for no results

// Append it to the gallery but hide it initially
noResultsMessage.textContent = "No results matching your search.";
noResultsMessage.style.display = 'none'; // Initially hide the message
gallery.appendChild(noResultsMessage);

/* Search Box */

searchBox.addEventListener('input', function() {
    const searchTerm = searchBox.value.toLowerCase();
    let hasResults = false; // Flag to track if we have any results

    cards.forEach(card => {
        const cardName = card.querySelector('h2').textContent.toLowerCase(); // Assuming the card title is in an <h2> tag
        // Check if the card name contains the search term
        if (cardName.includes(searchTerm)) {
            card.style.display = ''; // Show card
            hasResults = true; // We found at least one result
        } else {
            card.style.display = 'none'; // Hide card
        }
    });

    // Show or hide the no results message based on the hasResults flag
    if (hasResults) {
        noResultsMessage.style.display = 'none'; // Hide the message
    } else {
        noResultsMessage.style.display = ''; // Show the message
    }
});

const noResultsMessage = document.getElementById("noResultsMessage");

noResultsMessage.textContent =
  "Could not find any matches related to your search, please search for a different card.";
Then inside your search function, show or hide it based on whether any cards match:
if (hasResults) {
  noResultsMessage.style.display = "none";
} else {
  noResultsMessage.style.display = "block";
}
