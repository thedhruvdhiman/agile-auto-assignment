const axios = require("axios");
const cheerio = require("cheerio");

// const url = "https://quinndunki.com/blondihacks/?p=3023";

const scraper = async function (url) {
  try {
    const response = await axios.get(url);

    const html = response.data;
    const $ = cheerio.load(html);

    let content = "";
    $("p").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) {
        content = text;
        return false;
      }
    });
    return content.substring(0, 200) + "...";
  } catch (error) {
    console.error("Error fetching page:", error.message, "\nURL: ", url);
    return "...";
  }
};

module.exports = { scraper };
