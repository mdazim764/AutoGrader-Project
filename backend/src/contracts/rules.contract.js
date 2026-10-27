const ALLOWED_ANALYZERS = new Set([
  "io_tests",
  "compiler_warnings",
  "static_analysis",
  "function_split",
  "edge_case_runner",
  "complexity_estimator",
  "sanitizer_run",
  "llm_review",
  "similarity_flag",
  "ai_detection",
  "structure",
  "modularity",
  "memory_safety",
  "originality",
  "logical",
  "readability",
  "complexity",
]);

const DEFAULT_TIME_LIMIT_SEC = 1;
const DEFAULT_MEMORY_LIMIT_MB = 64;

class RuleValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "RuleValidationError";
    this.code = "INVALID_RULES";
    this.details = details;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseRules(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new RuleValidationError("Rules must contain valid JSON.");
    }
  }
  return value;
}

function normalizeMetric(metric, index) {
  if (!isPlainObject(metric)) {
    throw new RuleValidationError(`Metric ${index + 1} must be an object.`);
  }

  const name = typeof metric.name === "string" ? metric.name.trim() : "";
  const analyzer = typeof metric.analyzer === "string" && metric.analyzer.trim()
    ? metric.analyzer.trim()
    : name;
  const weight = Number(metric.weight);

  if (!name) {
    throw new RuleValidationError(`Metric ${index + 1} is missing a name.`);
  }
  if (!ALLOWED_ANALYZERS.has(analyzer)) {
    throw new RuleValidationError(
      `Metric "${name}" references unsupported analyzer "${analyzer}".`,
    );
  }
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new RuleValidationError(
      `Metric "${name}" must have a weight between 0 and 1.`,
    );
  }

  return {
    name,
    analyzer,
    weight,
    params: isPlainObject(metric.params) ? metric.params : {},
  };
}

function validateRules(value, limits = {}) {
  const parsed = parseRules(value);
  if (!isPlainObject(parsed)) {
    throw new RuleValidationError("Rules must be a JSON object.");
  }

  if (!Array.isArray(parsed.metrics) || parsed.metrics.length === 0) {
    throw new RuleValidationError("Rules must define at least one metric.");
  }

  const metrics = parsed.metrics.map(normalizeMetric);
  const weightTotal = metrics.reduce((total, metric) => total + metric.weight, 0);
  if (Math.abs(weightTotal - 1) > 0.000001) {
    throw new RuleValidationError(
      `Metric weights must sum to 1.0; received ${weightTotal.toFixed(6)}.`,
    );
  }

  const timeLimitSec = Number(parsed.time_limit_s ?? limits.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC);
  const memoryLimitMb = Number(parsed.memory_limit_mb ?? limits.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB);
  if (!Number.isInteger(timeLimitSec) || timeLimitSec <= 0) {
    throw new RuleValidationError("time_limit_s must be a positive integer.");
  }
  if (!Number.isInteger(memoryLimitMb) || memoryLimitMb <= 0) {
    throw new RuleValidationError("memory_limit_mb must be a positive integer.");
  }

  return {
    schema_version: typeof parsed.schema_version === "string" && parsed.schema_version
      ? parsed.schema_version
      : "1.0",
    problem: typeof parsed.problem === "string" ? parsed.problem : null,
    time_limit_s: timeLimitSec,
    memory_limit_mb: memoryLimitMb,
    metrics,
  };
}

module.exports = {
  ALLOWED_ANALYZERS,
  RuleValidationError,
  validateRules,
};
