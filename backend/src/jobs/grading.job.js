const { gradeSubmission } = require("../services/grading-orchestrator.service");

function enqueue(submissionId) {
  return gradeSubmission(submissionId);
}

module.exports = { enqueue };
