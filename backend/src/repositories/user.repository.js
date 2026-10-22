const prisma = require("../db");

function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

module.exports = { findByEmail };
