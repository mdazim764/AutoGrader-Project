const problemRepository = require("../repositories/problem.repository");

function listProblems() {
  return problemRepository.findAllPublic();
}

function createProblem(body, instructorId) {
  return problemRepository.create({
    title: body.title,
    statement: body.statement,
    timeLimitSec: body.timeLimitSec || 1,
    memoryLimitMb: body.memoryLimitMb || 64,
    rules: body.rules,
    instructorId,
  });
}

function updateProblem(id, data) {
  return problemRepository.update(id, data);
}

module.exports = { listProblems, createProblem, updateProblem };
