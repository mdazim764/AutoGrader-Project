const test = require("node:test");
const assert = require("node:assert/strict");
const { validateRules } = require("../src/contracts/rules.contract");
const { createReport } = require("../src/contracts/report.contract");

function baseRules(overrides = {}) {
  return {
    schema_version: "1.1",
    metrics: [
      { name: "logical", analyzer: "logical", weight: 0.6, params: {} },
      { name: "complexity", analyzer: "complexity", weight: 0.4, params: { required: "O(N)" } },
    ],
    tests: {
      public: [{ id: "basic", input: "5", expected: "120" }],
      hidden: [{ id: "boundary", input: "10", expected: "3628800" }],
    },
    integrity: {
      exact_peer_match_action: "ZERO_SCORE",
      similarity_review_threshold: 0.85,
      similarity_action: "REVIEW_ONLY",
      ai_action: "REVIEW_ONLY",
    },
    ...overrides,
  };
}

test("normalizes public and hidden tests into logical analyzer cases", () => {
  const rules = validateRules(baseRules());
  assert.equal(rules.schema_version, "1.1");
  assert.equal(rules.tests.public[0].id, "basic");
  assert.equal(rules.tests.hidden[0].id, "boundary");
  assert.equal(rules.metrics[0].params.cases.length, 2);
});

test("normalizes structured test inputs without producing [object Object]", () => {
  const rules = validateRules(baseRules({
    tests: {
      public: [{ id: "palindrome", input: { value: 121 }, expected: ["121"] }],
      hidden: [],
    },
  }));
  assert.equal(rules.tests.public[0].input, "121");
  assert.equal(rules.tests.public[0].expected, "121");
});

test("preserves legacy named cases without inventing malformed public inputs", () => {
  const rules = validateRules({
    schema_version: "1.0",
    metrics: [
      { name: "logical", weight: 1, params: { cases: ["basic", "zero"] } },
    ],
  });
  assert.deepEqual(rules.metrics[0].params.cases, ["basic", "zero"]);
  assert.deepEqual(rules.tests.public, []);
});

test("rejects weights that do not total one", () => {
  assert.throws(
    () => validateRules({
      metrics: [{ name: "logical", weight: 0.5, params: { cases: ["basic"] } }],
    }),
    /weights must sum to 1\.0/,
  );
});

test("rejects non-review-only AI integrity actions", () => {
  assert.throws(
    () => validateRules(baseRules({
      integrity: {
        exact_peer_match_action: "ZERO_SCORE",
        similarity_review_threshold: 0.85,
        similarity_action: "REVIEW_ONLY",
        ai_action: "ZERO_SCORE",
      },
    })),
    /AI authorship signals must remain REVIEW_ONLY/,
  );
});

test("validates similarity thresholds and integrity actions", () => {
  const rules = validateRules(baseRules({
    integrity: {
      exact_peer_match_action: "REVIEW_ONLY",
      similarity_review_threshold: 0.9,
      similarity_action: "REVIEW_ONLY",
      ai_action: "REVIEW_ONLY",
    },
  }));
  assert.equal(rules.integrity.exact_peer_match_action, "REVIEW_ONLY");
  assert.equal(rules.integrity.similarity_review_threshold, 0.9);
});

test("creates a report with schema and integrity metadata", () => {
  const report = createReport({
    submissionId: "submission-1",
    finalScore: 0,
    integrity: {
      decision: "EXACT_PEER_MATCH_ZERO_SCORE",
      marks_before_integrity: 96,
      marks_deducted: 100,
      marks_after_integrity: 0,
    },
  });
  assert.equal(report.schema_version, "1.1");
  assert.equal(report.integrity.marks_after_integrity, 0);
});
