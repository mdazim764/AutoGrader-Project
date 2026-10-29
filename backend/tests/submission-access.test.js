const test = require("node:test");
const assert = require("node:assert/strict");
const submissionRepository = require("../src/repositories/submission.repository");
const submissionService = require("../src/services/submission.service");

test("students can read only their own submissions", async () => {
  const original = submissionRepository.findByIdWithProblem;
  submissionRepository.findByIdWithProblem = async () => ({
    id: "submission-1",
    studentId: "student-1",
    problem: { instructorId: "instructor-1" },
  });
  try {
    const own = await submissionService.getSubmission("submission-1", {
      id: "student-1",
      role: "STUDENT",
    });
    assert.equal(own.id, "submission-1");

    await assert.rejects(
      () => submissionService.getSubmission("submission-1", {
        id: "student-2",
        role: "STUDENT",
      }),
      (error) => error.statusCode === 403,
    );
  } finally {
    submissionRepository.findByIdWithProblem = original;
  }
});

test("only the owning instructor can read course submissions", async () => {
  const original = submissionRepository.findByIdWithProblem;
  submissionRepository.findByIdWithProblem = async () => ({
    id: "submission-1",
    studentId: "student-1",
    problem: { instructorId: "instructor-1" },
  });
  try {
    const own = await submissionService.getSubmission("submission-1", {
      id: "instructor-1",
      role: "INSTRUCTOR",
    });
    assert.equal(own.id, "submission-1");

    await assert.rejects(
      () => submissionService.getSubmission("submission-1", {
        id: "instructor-2",
        role: "INSTRUCTOR",
      }),
      (error) => error.statusCode === 403,
    );
  } finally {
    submissionRepository.findByIdWithProblem = original;
  }
});
