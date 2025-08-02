const express = require("express");
const router = express.Router();
const {
  createProject,
  getProjects,
  startScraping,
  cancelTask,
} = require("../controllers/projectController");

router.post("/create", createProject);
router.get("/:vendorId", getProjects);
router.delete("/delete/:id", getProjects);

router.post("/start-scrape", startScraping);
router.post("/cancel-task", cancelTask);

module.exports = router;