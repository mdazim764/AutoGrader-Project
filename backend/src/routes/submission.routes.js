const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth.middleware");
const {
  createSubmission,
  getSubmission,
  listSubmissions,
} = require("../controllers/submission.controller");

router.post("/", authenticate, createSubmission);
router.get("/:id", getSubmission);
router.get("/", authenticate, listSubmissions);

module.exports = router;
