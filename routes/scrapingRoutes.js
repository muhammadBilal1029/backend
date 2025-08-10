const express = require("express");
const scrapeAllJobs = require("../services/jobScraping");
const scrapeAllProperties = require("../services/scrape_property");
const scrapeAllNews = require("../services/scrape_news");
const router = express.Router();

router.post("/jobs", scrapeAllJobs);
router.post("/property", scrapeAllProperties);
router.post("/news", scrapeAllNews);

module.exports = router;
