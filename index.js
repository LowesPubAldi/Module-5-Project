
const apiKey = 'ea445734'; 
const apiUrl = 'http://www.omdbapi.com/?apikey=ea445734&JasonStatham;' 

async function fetchData() {
    try {
        const response = await fetch(apiUrl, {
            method: 'GET', 
            headers: {
                'Authorization': `Bearer ${apiKey}`, 
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }

        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
}

fetchData();

