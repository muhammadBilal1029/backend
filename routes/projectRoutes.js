const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
  createProject,
  getProjects,
  startScraping,
  cancelTask,
} = require("../controllers/projectController");

router.post("/create", createProject,verifyToken);
router.get("/:vendorId", getProjects);
router.delete("/delete/:id", getProjects);

router.post("/start-scrape", startScraping);
router.post("/cancel-task", cancelTask);

module.exports = router;