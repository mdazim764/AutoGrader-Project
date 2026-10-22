const submissionRepository = require("../repositories/submission.repository");

async function createSubmission(problemId, code, studentId) {
  const previousAttempts = await submissionRepository.countByStudentAndProblem(
    studentId,
    problemId,
  );

  return submissionRepository.create({
    problemId,
    studentId,
    code,
    status: "PENDING",
    attemptNumber: previousAttempts + 1,
  });
}

function getSubmission(id) {
  return submissionRepository.findByIdWithProblem(id);
}

function listSubmissions() {
  return submissionRepository.findAllForAnalytics();
}

module.exports = { createSubmission, getSubmission, listSubmissions };
