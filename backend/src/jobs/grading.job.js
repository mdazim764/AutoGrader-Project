const { gradeSubmission } = require("../services/agent_coordinator");

function enqueue(submissionId) {
  return gradeSubmission(submissionId);
}

module.exports = { enqueue };
