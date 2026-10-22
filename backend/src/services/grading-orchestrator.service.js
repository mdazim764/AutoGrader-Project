const legacyCoordinator = require("./agent_coordinator.legacy");

async function gradeSubmission(submissionId) {
  return legacyCoordinator.gradeSubmission(submissionId);
}

module.exports = { gradeSubmission };
