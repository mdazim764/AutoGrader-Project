const { validateRules } = require("../contracts");

function loadDatabaseRules(problem) {
  if (!problem) {
    const error = new Error("Problem is required to load grading rules.");
    error.statusCode = 400;
    throw error;
  }

  return validateRules(problem.rules, {
    timeLimitSec: problem.timeLimitSec,
    memoryLimitMb: problem.memoryLimitMb,
  });
}

module.exports = { loadDatabaseRules };
