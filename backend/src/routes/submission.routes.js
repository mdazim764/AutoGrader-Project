const express = require("express");
const router = express.Router();
const { authenticate, isInstructor } = require("../middlewares/auth.middleware");
const {
  createSubmission,
  getSubmission,
  getLatestSubmission,
  listSubmissions,
} = require("../controllers/submission.controller");

router.post("/", authenticate, createSubmission);
router.get("/latest", authenticate, getLatestSubmission);
router.get("/:id", authenticate, getSubmission);
router.get("/", authenticate, isInstructor, listSubmissions);

module.exports = router;
