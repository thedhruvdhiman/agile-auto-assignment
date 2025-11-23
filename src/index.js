const axios = require("axios");
const csv = require("fast-csv");
const fs = require("fs");
const path = require("path");
const Parser = require("rss-parser");

const parser = new Parser();

const DATEOPTIONS = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

const KEYWORD = process.argv[3] || "AI automation"; // Default keyword if not provided
const SOURCES = {
  reddit: "https://www.reddit.com/search.rss",
  googleNews: "https://news.google.com/rss/search",
  hackerNews: "http://hn.algolia.com/api/v1/search",
};

const sourceName = process.argv[2] || "all";

const OUTPUT_FILE_DATE = {
  month: "long",
  day: "numeric",
};
const OUTPUT_FILE =
  new Date().toLocaleDateString("en-US", OUTPUT_FILE_DATE).replace(" ", "_") +
  "_" +
  KEYWORD.replace(/ /g, "_") +
  "_news.csv";

const REPORT_DIR = path.join(__dirname + "/../report");
const OUTPUTDIR = path.join(REPORT_DIR, OUTPUT_FILE);

let existingLinks = new Set();

// Function to read existing links from CSV to avoid duplicates
const readExistingLinks = () => {
  return new Promise((resolve) => {
    if (!fs.existsSync(OUTPUTDIR)) {
      return resolve();
    }
    fs.createReadStream(OUTPUTDIR)
      .pipe(csv.parse({ headers: true }))
      .on("error", (error) => console.error(error))
      .on("data", (row) => existingLinks.add(row.Link))
      .on("end", (rowCount) => {
        console.log(`Read ${rowCount} existing entries.`);
        resolve();
      });
  });
};

const fetchReddit = async (keyword) => {
  try {
    console.log(`Fetching Reddit for "${keyword}"...`);
    // const feedUrl = `https://www.reddit.com/search.rss?q=${encodeURIComponent(
    //   keyword
    // )}&sort=new`;
    const feedURL = `${SOURCES.reddit}?q=${keyword}&sort=new`;
    // const feedUrl = `https://www.reddit.com/search.rss?q=${keyword}&sort=new`;
    const feed = await parser.parseURL(feedURL);

    return feed.items.map((item) => ({
      Source: "Reddit",
      Title: item.title,
      Link: item.link,
      Date: new Date().toLocaleDateString("en-US", DATEOPTIONS),
      Summary: item.contentSnippet
        ? item.contentSnippet.substring(0, 200) + "..."
        : "",
    }));
  } catch (error) {
    console.error("Error fetching from Reddit:", error.message);
    return [];
  }
};

const fetchHackerNews = async (keyword) => {
  try {
    console.log(`Fetching Hacker News for "${keyword}"...`);
    const response = await axios.get(SOURCES.hackerNews, {
      params: { query: keyword, tags: "story" },
    });
    return response.data.hits.map((item) => ({
      Source: "Hacker News",
      Title: item.title,
      Link: item.url,
      Date: new Date().toLocaleDateString("en-US", DATEOPTIONS),
      Summary: item.story_text ? item.story_text.substring(0, 200) + "..." : "",
    }));
  } catch (error) {
    console.error("Error fetching from Hacker News:", error.message);
    return [];
  }
};

const fetchGoogleNews = async (keyword) => {
  try {
    console.log(`Fetching Google News for "${keyword}"...`);
    const feedUrl = `${SOURCES.googleNews}?q=${keyword}`;
    const feed = await parser.parseURL(feedUrl);

    return feed.items.map((item) => ({
      Source: "Google News",
      Title: item.title,
      Link: item.link,
      Date: new Date().toLocaleDateString("en-US", DATEOPTIONS),
      Summary: item.contentSnippet
        ? item.contentSnippet.substring(0, 200) + "..."
        : "",
    }));
  } catch (error) {
    console.error("Error fetching from Google News:", error.message);
    return [];
  }
};

const fetchData = async () => {
  console.log(`Starting data fetch for keyword: ${KEYWORD}`);
  let allResults = [];

  const fetchers = [];
  if (sourceName === "reddit" || sourceName === "all")
    fetchers.push(fetchReddit(KEYWORD));
  if (sourceName === "hackerNews" || sourceName === "all")
    fetchers.push(fetchHackerNews(KEYWORD));
  if (sourceName === "googleNews" || sourceName === "all")
    fetchers.push(fetchGoogleNews(KEYWORD));

  const results = await Promise.allSettled(fetchers);
  results.forEach((res) => {
    if (res.status === "fulfilled") {
      allResults = allResults.concat(res.value);
    }
  });

  // Filter duplicates
  const newResults = allResults.filter(
    (item) => item.Link && !existingLinks.has(item.Link)
  );

  if (newResults.length > 0) {
    newResults.forEach((item) => existingLinks.add(item.Link));

    const csvStream = csv.format({
      headers: !fs.existsSync(OUTPUTDIR),
      includeEndRowDelimiter: true,
    });

    const writableStream = fs.createWriteStream(OUTPUTDIR, { flags: "a" });

    writableStream.on("finish", () => {
      console.log(`${newResults.length} new results saved to ${OUTPUTDIR}`);
    });

    csvStream.pipe(writableStream);
    newResults.forEach((result) => csvStream.write(result));
    csvStream.end();
  } else {
    console.log("No new results found.");
  }
};

// Initial run
(async () => {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  await readExistingLinks();
  await fetchData();
})();
