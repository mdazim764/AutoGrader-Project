const {
  normalizeAnalyzerResult,
} = require("./analyzer-result.contract");

const REPORT_SCHEMA_VERSION = "1.0";

function normalizeReportMetric(metric) {
  const normalized = normalizeAnalyzerResult(
    {
      status: metric.status,
      score: metric.score,
      evidence: metric.evidence || metric.details || {},
      feedback: metric.feedback || metric.details?.feedback,
      errors: metric.errors,
      reviewOnly: metric.reviewOnly,
    },
    metric.name,
    metric.weight ?? 0,
  );

  return {
    ...normalized,
    ...(metric.details ? { details: metric.details } : {}),
    ...(metric.aiFeedback ? { aiFeedback: metric.aiFeedback } : {}),
  };
}

function createReport({
  submissionId,
  submissionHash = null,
  rulesHash = null,
  testSetHash = null,
  toolVersions = {},
  firstPass = {},
  metrics = [],
  finalScore = null,
  flags = [],
  usefulness = [],
  limitations = [],
  generatedBy = "backend-grading-worker",
}) {
  if (!submissionId) {
    throw new Error("A report requires a submissionId.");
  }

  return {
    schema_version: REPORT_SCHEMA_VERSION,
    submission: {
      id: submissionId,
      hash: submissionHash,
    },
    rules_hash: rulesHash,
    test_set_hash: testSetHash,
    tool_versions: toolVersions,
    first_pass: firstPass,
    metrics: metrics.map(normalizeReportMetric),
    overall_score: finalScore,
    flags,
    generated_by: generatedBy,
    usefulness_limitations: {
      usefulness,
      limitations,
    },
  };
}

module.exports = {
  REPORT_SCHEMA_VERSION,
  createReport,
};
