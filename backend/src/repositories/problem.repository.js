const prisma = require("../db");

function findAllPublic() {
  return prisma.problem.findMany({
    select: {
      id: true,
      title: true,
      statement: true,
      timeLimitSec: true,
      memoryLimitMb: true,
      rules: true,
    },
  });
}

function create(data) {
  return prisma.problem.create({ data });
}

function findById(id) {
  return prisma.problem.findUnique({ where: { id } });
}

function update(id, data) {
  return prisma.problem.update({ where: { id }, data });
}

function updateOwned(id, instructorId, data) {
  return prisma.problem.updateMany({
    where: { id, instructorId },
    data,
  });
}

module.exports = { findAllPublic, findById, create, update, updateOwned };
