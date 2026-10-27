const ANALYZER_STATUSES = new Set([
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
  "BLOCKED",
]);

class AnalyzerResultValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AnalyzerResultValidationError";
    this.code = "INVALID_ANALYZER_RESULT";
  }
}

function normalizeAnalyzerResult(result, metric, weight) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new AnalyzerResultValidationError(
      `Analyzer "${metric}" must return an object.`,
    );
  }

  const status = result.status || "SUCCEEDED";
  if (!ANALYZER_STATUSES.has(status)) {
    throw new AnalyzerResultValidationError(
      `Analyzer "${metric}" returned unsupported status "${status}".`,
    );
  }

  const score = result.score === null || result.score === undefined
    ? null
    : Number(result.score);
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 1)) {
    throw new AnalyzerResultValidationError(
      `Analyzer "${metric}" score must be between 0 and 1.`,
    );
  }

  const normalizedScore = status === "SUCCEEDED" ? score : null;
  return {
    name: metric,
    status,
    score: normalizedScore,
    weight: Number(weight),
    contribution: normalizedScore === null ? null : normalizedScore * Number(weight) * 100,
    evidence: result.evidence && typeof result.evidence === "object" ? result.evidence : {},
    ...(result.details !== undefined ? { details: result.details } : {}),
    ...(result.aiFeedback ? { aiFeedback: result.aiFeedback } : {}),
    ...(result.reviewOnly ? { reviewOnly: true } : {}),
    feedback: typeof result.feedback === "string" ? result.feedback : null,
    errors: Array.isArray(result.errors) ? result.errors : [],
  };
}

function calculateFinalScore(metrics) {
  return metrics.reduce(
    (total, metric) => total + (metric.contribution === null ? 0 : metric.contribution),
    0,
  );
}

module.exports = {
  ANALYZER_STATUSES,
  AnalyzerResultValidationError,
  normalizeAnalyzerResult,
  calculateFinalScore,
};
