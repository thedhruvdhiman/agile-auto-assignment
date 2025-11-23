const axios = require("axios");
const csv = require("fast-csv");
const fs = require("fs");
const path = require("path");
const { parse } = require("fast-csv");

const DATEOPTIONS = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

const KEYWORD = process.argv[3];
const SOURCES = {
  reddit: "https://www.reddit.com/search.json",
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
  process.argv[3] +
  "_news.csv";

const REPORT_DIR = path.join(__dirname + "/../report");
const OUTPUTDIR = path.join(REPORT_DIR, OUTPUT_FILE);

let set = new Set();

// Function to read existing links from CSV to avoid duplicates
const readset = () => {
  return new Promise((resolve) => {
    if (!fs.existsSync(OUTPUTDIR)) {
      return resolve();
    }
    fs.createReadStream(OUTPUTDIR)
      // .pipe(parse())
      .pipe(csv.parse({ headers: true })) // exclude the headers
      .on("error", (error) => console.error(error))
      .on("data", (row) => set.add(row.Link))
      .on("end", (rowCount) => {
        console.log(`Read ${rowCount} existing entries.`);
        resolve();
      });
  });
};

const fetchReddit = async (keyword) => {
  try {
    const response = await axios.get(SOURCES.reddit, {
      params: { q: keyword, sort: "new" },
      headers: {
        "User-Agent": "node:data_aggregation:v1.0.0",
      },
    });
    return response.data.data.children.map((item) => ({
      Source: "Reddit",
      Title: item.data.title,
      Link: `https://www.reddit.com${item.data.permalink}`,
      Date: new Date().toLocaleDateString("en-US", DATEOPTIONS),
      Summary: item.data.selftext ? item.data.selftext : "",
    }));
  } catch (error) {
    throw new Error("Error fetching from Reddit:", error.message);
  }
};

const fetchHackerNews = async (keyword) => {
  try {
    const response = await axios.get(SOURCES.hackerNews, {
      params: { query: keyword, tags: "story" },
      headers: {
        "User-Agent": "node:data_aggregation:v1.0.0",
      },
    });
    return response.data.hits.map((item) => ({
      Source: "Hacker News",
      Title: item.title,
      Link: item.url,
      Date: new Date().toLocaleDateString("en-US", DATEOPTIONS),
      Summary: item.story_text ? item.story_text : "",
    }));
  } catch (error) {
    throw new Error("Error fetching from Hacker News:", error.message);
  }
};

const fetchData = async () => {
  console.log("Fetching data...");
  let allResults = [];

  if (sourceName === "reddit") {
    allResults = await fetchReddit(KEYWORD);
  } else if (sourceName === "hackerNews") {
    allResults = await fetchHackerNews(KEYWORD);
  } else if (sourceName === "all") {
    allResults = allResults.concat(
      await fetchReddit(KEYWORD),
      await fetchHackerNews(KEYWORD)
    );
  } else {
    // do nothing
  }

  // for (const keyword of KEYWORD) {
  //     const redditResults = await fetchReddit(keyword);
  //     const hackerNewsResults = await fetchHackerNews(keyword);
  //     allResults = allResults.concat(redditResults, hackerNewsResults);
  // }

  const newResults = allResults.filter(
    (item) => item.Link && !set.has(item.Link)
  );

  if (newResults.length > 0) {
    newResults.forEach((item) => set.add(item.Link));
    const csvStream = csv.format({
      headers: true,
      append: fs.existsSync(OUTPUTDIR),
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

// npm run reddit "Blockchain"
(async () => {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  await readset();
  await fetchData();
})();
