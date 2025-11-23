# News Aggregator Project!!! 🚀

Hi everyone! 👋 This is a project I made to help me find news about stuff I like without searching everywhere manually. It looks at Reddit, Hacker News, and Google News for me.

## What it does

It searches for a keyword (like "AI" or "Cats") and saves all the links it finds into a CSV file in the `report` folder. It also checks if the link is already there so it doesn't save it twice!

## How to run it on your computer

1. Make sure you have Node.js installed. "I think any version is fine"
2. Open your terminal (or command prompt) in this folder.
3. Install all the dependencies
   ```bash
   npm install
   ```

## How to use it

To run it with the default settings (it searches for "AI automation"), just type:

```bash
npm run start
```

If you want to search for something else, you can type the source and the keyword. Like this:

```bash
npm run start all "javascript"
```

Or if you only want Google news only:

```bash
npm run start googleNews "cats"
```

## Dependencies

- `axios` (for fetching data)
- `fast-csv` (to make the excel file thingy)
- `rss-parser` (to read the RSS feeds)
