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
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const INTEGRITY_ACTIONS = new Set(["ZERO_SCORE", "REVIEW_ONLY", "BLOCK_SUBMISSION"]);

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

function normalizeCaseValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(normalizeCaseValue).join(" ");
  if (isPlainObject(value)) {
    if (value.value !== undefined) return normalizeCaseValue(value.value);
    if (value.input !== undefined) return normalizeCaseValue(value.input);
    return Object.values(value).map(normalizeCaseValue).join(" ");
  }
  return String(value);
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

function normalizeTestCase(testCase, index, visibility) {
  if (!isPlainObject(testCase)) {
    throw new RuleValidationError(
      `${visibility} test case ${index + 1} must be an object.`,
    );
  }

  const id = typeof testCase.id === "string" && testCase.id.trim()
    ? testCase.id.trim()
    : typeof testCase.case === "string" && testCase.case.trim()
      ? testCase.case.trim()
      : `${visibility}_${index + 1}`;
  const input = normalizeCaseValue(testCase.input);
  const expected = normalizeCaseValue(testCase.expected);
  if (!input.trim() && !expected.trim()) {
    throw new RuleValidationError(
      `${visibility} test case "${id}" must define input or expected output.`,
    );
  }

  const weight = testCase.weight === undefined ? null : Number(testCase.weight);
  if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
    throw new RuleValidationError(
      `${visibility} test case "${id}" weight must be a non-negative number.`,
    );
  }

  return {
    id,
    case: typeof testCase.case === "string" && testCase.case.trim()
      ? testCase.case.trim()
      : id,
    input,
    expected,
    ...(weight === null ? {} : { weight }),
    ...(typeof testCase.description === "string" ? { description: testCase.description } : {}),
  };
}

function normalizeTests(parsed) {
  const configured = isPlainObject(parsed.tests) ? parsed.tests : {};
  const hasExplicitTests = Array.isArray(configured.public) || Array.isArray(configured.hidden);
  const legacyCases = parsed.metrics
    .flatMap((metric) => Array.isArray(metric.params?.cases) ? metric.params.cases : [])
    .filter((testCase, index, cases) =>
      cases.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(testCase)) === index,
    );
  const publicValues = Array.isArray(configured.public) ? configured.public : [];
  const hiddenValues = Array.isArray(configured.hidden) ? configured.hidden : [];
  const publicCases = publicValues.map((testCase, index) =>
    normalizeTestCase(
      typeof testCase === "string"
        ? { id: testCase, case: testCase, input: testCase, expected: "" }
        : testCase,
      index,
      "Public",
    ),
  );
  const hiddenCases = hiddenValues.map((testCase, index) =>
    normalizeTestCase(testCase, index, "Hidden"),
  );

  return {
    public: publicCases,
    hidden: hiddenCases,
    has_explicit_tests: hasExplicitTests,
  };
}

function normalizeProblemSpec(value) {
  if (value === undefined) return null;
  if (!isPlainObject(value)) {
    throw new RuleValidationError("problem_spec must be a JSON object.");
  }
  return value;
}

function normalizeIntegrity(value) {
  const integrity = value === undefined ? {} : value;
  if (!isPlainObject(integrity)) {
    throw new RuleValidationError("integrity must be a JSON object.");
  }
  const exactPeerMatchAction = integrity.exact_peer_match_action || "ZERO_SCORE";
  const similarityAction = integrity.similarity_action || "REVIEW_ONLY";
  const aiAction = integrity.ai_action || "REVIEW_ONLY";
  if (!INTEGRITY_ACTIONS.has(exactPeerMatchAction)
    || !INTEGRITY_ACTIONS.has(similarityAction)
    || !INTEGRITY_ACTIONS.has(aiAction)) {
    throw new RuleValidationError(
      "Integrity actions must be ZERO_SCORE, REVIEW_ONLY, or BLOCK_SUBMISSION.",
    );
  }
  const threshold = Number(
    integrity.similarity_review_threshold ?? DEFAULT_SIMILARITY_THRESHOLD,
  );
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RuleValidationError(
      "integrity.similarity_review_threshold must be between 0 and 1.",
    );
  }
  if (aiAction !== "REVIEW_ONLY") {
    throw new RuleValidationError("AI authorship signals must remain REVIEW_ONLY.");
  }
  return {
    exact_peer_match_action: exactPeerMatchAction,
    similarity_review_threshold: threshold,
    similarity_action: similarityAction,
    ai_action: aiAction,
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
  const schemaVersion = parsed.schema_version === undefined
    ? "1.1"
    : String(parsed.schema_version);
  if (!["1.0", "1.1"].includes(schemaVersion)) {
    throw new RuleValidationError(
      `Unsupported rules schema version "${schemaVersion}".`,
    );
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
  const tests = normalizeTests(parsed);
  const integrity = normalizeIntegrity(parsed.integrity);
  const problemSpec = normalizeProblemSpec(parsed.problem_spec);
  const allCases = [...tests.public, ...tests.hidden];
  const metricsWithCases = metrics.map((metric) => {
    if (!["logical", "edge_case_runner", "io_tests"].includes(metric.analyzer)) {
      return metric;
    }
    return {
      ...metric,
      params: {
        ...metric.params,
        cases: tests.has_explicit_tests && allCases.length > 0 ? allCases : metric.params.cases,
      },
    };
  });

  return {
    schema_version: schemaVersion,
    problem: typeof parsed.problem === "string" ? parsed.problem : null,
    time_limit_s: timeLimitSec,
    memory_limit_mb: memoryLimitMb,
    tests: {
      public: tests.public,
      hidden: tests.hidden,
    },
    problem_spec: problemSpec,
    integrity,
    metrics: metricsWithCases,
  };
}

module.exports = {
  ALLOWED_ANALYZERS,
  INTEGRITY_ACTIONS,
  RuleValidationError,
  validateRules,
};
