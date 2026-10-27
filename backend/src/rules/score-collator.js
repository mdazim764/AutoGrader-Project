const {
  calculateFinalScore,
  normalizeAnalyzerResult,
} = require("../contracts");

function collateMetric(metric, result) {
  return normalizeAnalyzerResult(result, metric.name, metric.weight);
}

function collateResults(results) {
  const metrics = results.map(({ metric, result }) => collateMetric(metric, result));
  return {
    metrics,
    finalScore: calculateFinalScore(metrics),
  };
}

module.exports = { collateMetric, collateResults };
