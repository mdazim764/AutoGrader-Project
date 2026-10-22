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
    include: { problem: { select: { title: true } } },
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
  findAllForAnalytics,
};
