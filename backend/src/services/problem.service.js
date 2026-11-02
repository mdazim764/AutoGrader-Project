const problemRepository = require("../repositories/problem.repository");
const { validateRules } = require("../contracts");

async function listProblems(user) {
  const problems = await problemRepository.findAllPublic();
  if (user?.role === "INSTRUCTOR") return problems;

  return problems.map((problem) => {
    const rules = typeof problem.rules === "object" && problem.rules !== null
      ? problem.rules
      : {};
    const tests = rules.tests && typeof rules.tests === "object" ? rules.tests : {};
    const metrics = Array.isArray(rules.metrics)
      ? rules.metrics.map((metric) => {
        const cases = metric?.params?.cases;
        if (!Array.isArray(cases)) return metric;
        return {
          ...metric,
          params: {
            ...metric.params,
            cases: cases.filter((testCase) => testCase?.visibility !== "hidden"),
          },
        };
      })
      : rules.metrics;
    return {
      ...problem,
      rules: {
        ...rules,
        metrics,
        tests: {
          ...tests,
          hidden: [],
          hidden_tests: [],
        },
      },
    };
  });
}

function createProblem(body, instructorId) {
  const timeLimitSec = body.timeLimitSec || 1;
  const memoryLimitMb = body.memoryLimitMb || 64;
  const rules = validateRules(body.rules, { timeLimitSec, memoryLimitMb });

  return problemRepository.create({
    title: body.title,
    statement: body.statement,
    timeLimitSec: rules.time_limit_s,
    memoryLimitMb: rules.memory_limit_mb,
    rules,
    instructorId,
  });
}

async function updateProblem(id, data, instructorId) {
  const current = await problemRepository.findById(id);
  if (!current) {
    const error = new Error("Problem not found.");
    error.statusCode = 404;
    throw error;
  }

  const timeLimitSec = data.timeLimitSec ?? current.timeLimitSec;
  const memoryLimitMb = data.memoryLimitMb ?? current.memoryLimitMb;
  const rules = validateRules(data.rules ?? current.rules, {
    timeLimitSec,
    memoryLimitMb,
  });

  const updated = await problemRepository.updateOwned(id, instructorId, {
    ...(data.title === undefined ? {} : { title: data.title }),
    ...(data.statement === undefined ? {} : { statement: data.statement }),
    timeLimitSec: rules.time_limit_s,
    memoryLimitMb: rules.memory_limit_mb,
    rules,
  });
  if (updated.count !== 1) {
    const error = new Error("You do not own this problem.");
    error.statusCode = 403;
    throw error;
  }
  return problemRepository.findById(id);
}

module.exports = { listProblems, createProblem, updateProblem };
