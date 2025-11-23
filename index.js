const axios = require('axios');
const cron = require('node-cron');
const csv = require('fast-csv');
const fs = require('fs');

const KEYWORDS = ['AI automation', 'business tools'];
const SOURCES = {
    reddit: 'https://www.reddit.com/search.json',
    hackerNews: 'http://hn.algolia.com/api/v1/search'
};
const OUTPUT_FILE = 'results.csv';

let existingLinks = new Set();

// Function to read existing links from CSV to avoid duplicates
const readExistingLinks = () => {
    return new Promise((resolve) => {
        if (!fs.existsSync(OUTPUT_FILE)) {
            return resolve();
        }
        fs.createReadStream(OUTPUT_FILE)
            .pipe(csv.parse({ headers: true }))
            .on('error', error => console.error(error))
            .on('data', row => existingLinks.add(row.Link))
            .on('end', rowCount => {
                console.log(`Read ${rowCount} existing entries.`);
                resolve();
            });
    });
};

// Fetch from Reddit
const fetchReddit = async (keyword) => {
    try {
        const response = await axios.get(SOURCES.reddit, { params: { q: keyword, sort: 'new' } });
        return response.data.data.children.map(item => ({
            Source: 'Reddit',
            Title: item.data.title,
            Link: `https://www.reddit.com${item.data.permalink}`,
            Date: new Date(item.data.created_utc * 1000).toISOString(),
            Summary: item.data.selftext.substring(0, 100)
        }));
    } catch (error) {
        console.error('Error fetching from Reddit:', error.message);
        return [];
    }
};

// Fetch from Hacker News
const fetchHackerNews = async (keyword) => {
    try {
        const response = await axios.get(SOURCES.hackerNews, { params: { query: keyword, tags: 'story' } });
        return response.data.hits.map(item => ({
            Source: 'Hacker News',
            Title: item.title,
            Link: item.url,
            Date: new Date(item.created_at).toISOString(),
            Summary: item.story_text ? item.story_text.substring(0, 100) : ''
        }));
    } catch (error) {
        console.error('Error fetching from Hacker News:', error.message);
        return [];
    }
};

const fetchData = async () => {
    console.log('Fetching data...');
    let allResults = [];

    for (const keyword of KEYWORDS) {
        const redditResults = await fetchReddit(keyword);
        const hackerNewsResults = await fetchHackerNews(keyword);
        allResults = allResults.concat(redditResults, hackerNewsResults);
    }

    const newResults = allResults.filter(item => item.Link && !existingLinks.has(item.Link));

    if (newResults.length > 0) {
        newResults.forEach(item => existingLinks.add(item.Link));
        const csvStream = csv.format({ headers: true, append: fs.existsSync(OUTPUT_FILE) });
        const writableStream = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' });

        writableStream.on('finish', () => {
            console.log(`${newResults.length} new results saved to ${OUTPUT_FILE}`);
        });

        csvStream.pipe(writableStream);
        newResults.forEach(result => csvStream.write(result));
        csvStream.end();
    } else {
        console.log('No new results found.');
    }
};

// Schedule the task
cron.schedule('0 9 * * *', async () => {
    console.log('Running scheduled job...');
    await readExistingLinks();
    await fetchData();
});

// Initial run
(async () => {
    await readExistingLinks();
    await fetchData();
})();
