const test = require("node:test");
const assert = require("node:assert/strict");
const { collateResults } = require("../src/rules/score-collator");
const { runOriginalityAnalyzer } = require("../src/analyzers/originality.analyzer");
const {
  formatExecutionValue,
} = require("../src/services/agent_coordinator.legacy");
const { executeConfiguredRules } = require("../src/rules/rule-engine.service");
const {
  normalizeAnalyzerResult,
  calculateFinalScore,
} = require("../src/contracts/analyzer-result.contract");

test("collates weighted metric contributions", () => {
  const result = collateResults([
    {
      metric: { name: "logical", weight: 0.6 },
      result: { status: "SUCCEEDED", score: 0.75, evidence: { passed: 3 } },
    },
    {
      metric: { name: "complexity", weight: 0.4 },
      result: { status: "SUCCEEDED", score: 1, evidence: { estimated: "O(N)" } },
    },
  ]);

  assert.ok(Math.abs(result.metrics[0].contribution - 45) < 0.000001);
  assert.equal(result.metrics[1].contribution, 40);
  assert.equal(result.finalScore, 85);
});

test("blocked and skipped metrics do not create score contributions", () => {
  const metrics = [
    normalizeAnalyzerResult(
      { status: "BLOCKED", score: 1, errors: ["compile failed"] },
      "logical",
      0.8,
    ),
    normalizeAnalyzerResult(
      { status: "SKIPPED", score: 1, errors: ["not configured"] },
      "memory_safety",
      0.2,
    ),
  ];

  assert.equal(calculateFinalScore(metrics), 0);
  assert.equal(metrics[0].score, null);
  assert.equal(metrics[1].contribution, null);
});

test("review-only AI metrics can carry evidence without affecting marks", () => {
  const result = normalizeAnalyzerResult(
    {
      status: "SUCCEEDED",
      score: null,
      reviewOnly: true,
      evidence: { signal: true, confidence: 90 },
    },
    "ai_detection",
    0,
  );

  assert.equal(result.reviewOnly, true);
  assert.equal(result.contribution, null);
  assert.equal(result.evidence.signal, true);
});

test("originality flags exact token similarity at the configured threshold", () => {
  const result = runOriginalityAnalyzer(
    "int main(){return 0;}",
    [{ id: "peer-1", code: "int main(){return 0;}" }],
    0.85,
  );

  assert.equal(result.evidence.flagged, true);
  assert.equal(result.evidence.similarity, 1);
  assert.equal(result.evidence.matched_submission, "peer-1");
  assert.match(result.feedback, /review/i);
});

test("originality leaves materially different code below the threshold", () => {
  const result = runOriginalityAnalyzer(
    "#include <stdio.h>\nint main(void){ puts(\"hello\"); }",
    [{ id: "peer-1", code: "#include <math.h>\nint main(void){ return 42; }" }],
    0.85,
  );

  assert.equal(result.evidence.flagged, false);
  assert.equal(result.score, 1);
});

test("formats structured test values into stdin-safe text", () => {
  assert.equal(formatExecutionValue(121), "121");
  assert.equal(formatExecutionValue([1, 2, 3]), "1 2 3");
  assert.equal(formatExecutionValue({ value: "racecar" }), "racecar");
  assert.equal(formatExecutionValue({ input: 10 }), "10");
});

test("marks unavailable AI review as skipped without affecting the grade", async () => {
  const result = await executeConfiguredRules(
    {
      metrics: [{ name: "ai_detection", analyzer: "ai_detection", weight: 0, params: {} }],
    },
    {
      runAiDetection: async () => ({
        signal: false,
        error: "Ollama is unavailable",
        reason: "AI review was unavailable.",
      }),
    },
  );

  assert.equal(result.metrics[0].status, "SKIPPED");
  assert.equal(result.metrics[0].contribution, null);
  assert.equal(result.finalScore, 0);
});
