const prisma = require("../db");

function findAllPublic() {
  return prisma.problem.findMany({
    select: {
      id: true,
      title: true,
      statement: true,
      timeLimitSec: true,
      memoryLimitMb: true,
    },
  });
}

function create(data) {
  return prisma.problem.create({ data });
}

function update(id, data) {
  return prisma.problem.update({ where: { id }, data });
}

module.exports = { findAllPublic, create, update };
