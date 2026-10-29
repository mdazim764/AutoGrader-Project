const prisma = require("../db");

function countByStudentAndProblem(studentId, problemId) {
  return prisma.submission.count({ where: { studentId, problemId } });
}

function create(data) {
  return prisma.submission.create({ data });
}

function findByIdWithProblem(id) {
  return prisma.submission.findUnique({
    where: { id },
    include: {
      problem: { select: { title: true, instructorId: true } },
      matchedWith: { select: { id: true, student: { select: { name: true, email: true } } } },
    },
  });
}

function findLatestByStudentAndProblem(studentId, problemId) {
  return prisma.submission.findFirst({
    where: { studentId, problemId },
    include: {
      problem: { select: { title: true, instructorId: true } },
      matchedWith: { select: { id: true, student: { select: { name: true, email: true } } } },
    },
    orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
  });
}

function claimForGrading(id) {
  return prisma.submission.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "GRADING" },
  });
}

function findAllForAnalytics() {
  return prisma.submission.findMany({
    include: {
      student: { select: { name: true, email: true } },
      problem: { select: { title: true } },
      matchedWith: {
        select: {
          student: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  countByStudentAndProblem,
  create,
  findByIdWithProblem,
  findLatestByStudentAndProblem,
  claimForGrading,
  findAllForAnalytics,
};
