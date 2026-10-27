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

async function getSubmission(id, user) {
  const submission = await submissionRepository.findByIdWithProblem(id);
  if (!submission) return null;
  const allowed = user.role === "INSTRUCTOR"
    ? submission.problem.instructorId === user.id
    : submission.studentId === user.id;
  if (!allowed) {
    const error = new Error("You do not have access to this submission.");
    error.statusCode = 403;
    throw error;
  }
  return submission;
}

function listSubmissions() {
  return submissionRepository.findAllForAnalytics();
}

module.exports = { createSubmission, getSubmission, listSubmissions };
