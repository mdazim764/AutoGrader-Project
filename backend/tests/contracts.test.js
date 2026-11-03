const test = require("node:test");
const assert = require("node:assert/strict");
const { validateRules } = require("../src/contracts/rules.contract");
const { createReport } = require("../src/contracts/report.contract");
const {
  validateGeneratedTests,
} = require("../src/services/agents/hidden-tests.agent");

function baseRules(overrides = {}) {
  return {
    schema_version: "1.1",
    metrics: [
      { name: "logical", analyzer: "logical", weight: 0.6, params: {} },
      {
        name: "complexity",
        analyzer: "complexity",
        weight: 0.4,
        params: { required: "O(N)" },
      },
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
  assert.equal(rules.tests.public[0].visibility, "public");
  assert.equal(rules.tests.hidden[0].visibility, "hidden");
  assert.equal(rules.metrics[0].params.cases.length, 2);
});

test("normalizes structured test inputs without producing [object Object]", () => {
  const rules = validateRules(
    baseRules({
      tests: {
        public: [
          { id: "palindrome", input: { value: 121 }, expected: ["121"] },
        ],
        hidden: [],
      },
    }),
  );
  assert.equal(rules.tests.public[0].input, "121");
  assert.equal(rules.tests.public[0].expected, "121");
});

test("normalizes hidden_tests aliases as hidden execution cases", () => {
  const rules = validateRules({
    schema_version: "1.1",
    public_tests: [{ id: "sample", input: "1", expected: "1" }],
    hidden_tests: [{ id: "boundary", input: "999", expected: "999" }],
    metrics: [{ name: "logical", analyzer: "logical", weight: 1, params: {} }],
  });
  assert.equal(rules.tests.public.length, 1);
  assert.equal(rules.tests.hidden.length, 1);
  assert.equal(rules.tests.hidden[0].visibility, "hidden");
  assert.equal(rules.metrics[0].params.cases.length, 2);
});

test("validates generated hidden tests and removes public duplicates", () => {
  const tests = validateGeneratedTests(
    {
      hidden_tests: [
        { id: "duplicate", input: "1", expected: "1" },
        { id: "boundary", input: "999", expected: "999" },
      ],
    },
    [{ id: "sample", input: "1", expected: "1" }],
  );
  assert.equal(tests.length, 1);
  assert.equal(tests[0].id, "boundary");
  assert.equal(tests[0].source, "ai_generated");
});

test("accepts a persisted rules object with a null problem specification", () => {
  const rules = validateRules({
    schema_version: "1.1",
    problem_spec: null,
    tests: {
      public: [{ id: "sample", input: "1", expected: "1" }],
      hidden: [{ id: "generated", input: "2", expected: "2" }],
    },
    metrics: [{ name: "logical", analyzer: "logical", weight: 1, params: {} }],
  });
  assert.equal(rules.problem_spec, null);
  assert.equal(rules.tests.hidden.length, 1);
});

test("promotes legacy named cases into canonical public tests", () => {
  const rules = validateRules({
    schema_version: "1.0",
    metrics: [
      { name: "logical", weight: 1, params: { cases: ["basic", "zero"] } },
    ],
  });
  assert.deepEqual(
    rules.metrics[0].params.cases.map((testCase) => testCase.case),
    ["basic", "zero"],
  );
  assert.deepEqual(
    rules.tests.public.map((testCase) => testCase.case),
    ["basic", "zero"],
  );
});

test("does not duplicate hidden cases when repairing legacy public tests", () => {
  const rules = validateRules({
    schema_version: "1.1",
    tests: {
      public: [],
      hidden: [{ id: "generated", input: "99", expected: "99" }],
    },
    metrics: [
      {
        name: "logical",
        analyzer: "logical",
        weight: 1,
        params: {
          cases: [
            { id: "public-legacy", input: "1", expected: "1" },
            { id: "generated", input: "99", expected: "99" },
          ],
        },
      },
    ],
  });
  assert.deepEqual(
    rules.tests.public.map((testCase) => testCase.id),
    ["public-legacy"],
  );
  assert.equal(rules.tests.hidden.length, 1);
});

test("rejects weights that do not total one", () => {
  assert.throws(
    () =>
      validateRules({
        metrics: [
          { name: "logical", weight: 0.5, params: { cases: ["basic"] } },
        ],
      }),
    /weights must sum to 1\.0/,
  );
});

test("rejects non-review-only AI integrity actions", () => {
  assert.throws(
    () =>
      validateRules(
        baseRules({
          integrity: {
            exact_peer_match_action: "ZERO_SCORE",
            similarity_review_threshold: 0.85,
            similarity_action: "REVIEW_ONLY",
            ai_action: "ZERO_SCORE",
          },
        }),
      ),
    /AI authorship signals must remain REVIEW_ONLY/,
  );
});

test("validates similarity thresholds and integrity actions", () => {
  const rules = validateRules(
    baseRules({
      integrity: {
        exact_peer_match_action: "REVIEW_ONLY",
        similarity_review_threshold: 0.9,
        similarity_action: "REVIEW_ONLY",
        ai_action: "REVIEW_ONLY",
      },
    }),
  );
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

test("persists test execution coverage and generated counter-case status", () => {
  const report = createReport({
    submissionId: "submission-coverage",
    testExecution: {
      configured: { public_count: 1, hidden_count: 1, total_count: 2 },
      executed: {
        public_count: 1,
        hidden_count: 1,
        total_count: 2,
        all_configured: true,
      },
      counter_cases: [
        {
          input: "99",
          expected: "100",
          status: "GENERATED_NOT_EXECUTED",
          executed: false,
          scored: false,
        },
      ],
    },
  });
  assert.equal(report.test_execution.executed.hidden_count, 1);
  assert.equal(report.test_execution.counter_cases[0].executed, false);
});
