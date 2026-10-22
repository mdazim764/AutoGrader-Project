const gradingJob = require("../jobs/grading.job");
const submissionService = require("../services/submission.service");

async function createSubmission(req, res) {
  try {
    const { problemId, code } = req.body;
    if (!problemId || !code) {
      return res
        .status(400)
        .json({ error: "Problem ID and Code are required." });
    }

    const submission = await submissionService.createSubmission(
      problemId,
      code,
      req.user.id,
    );

    gradingJob.enqueue(submission.id).catch((err) =>
      console.error("Agent Error:", err),
    );

    res.json({
      message: "Submission received. Agent is grading...",
      submissionId: submission.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getSubmission(req, res) {
  try {
    const submission = await submissionService.getSubmission(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: "Submission not found." });
    }
    res.json(submission);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch submission details." });
  }
}

async function listSubmissions(req, res) {
  try {
    res.json(await submissionService.listSubmissions());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch all submissions." });
  }
}

module.exports = { createSubmission, getSubmission, listSubmissions };