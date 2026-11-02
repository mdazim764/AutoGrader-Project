const { generateJson, getConfiguration } = require("./ollama.client");

function normalizeText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function keyFor(testCase) {
  return `${normalizeText(testCase.input)}\u0000${normalizeText(testCase.expected)}`;
}

function validateGeneratedTests(value, publicTests) {
  const candidates = Array.isArray(value)
    ? value
    : Array.isArray(value?.hidden_tests)
      ? value.hidden_tests
      : Array.isArray(value?.tests)
        ? value.tests
        : [];
  const publicKeys = new Set(publicTests.map(keyFor));
  const seen = new Set(publicKeys);
  const tests = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const input = normalizeText(candidate.input);
    const expected = normalizeText(candidate.expected);
    if (!input || !expected) continue;
    const key = `${input}\u0000${expected}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tests.push({
      id: normalizeText(candidate.id || candidate.case || `ai_hidden_${tests.length + 1}`),
      case: normalizeText(candidate.case || candidate.id || `AI hidden case ${tests.length + 1}`),
      input,
      expected,
      description: normalizeText(candidate.description || "AI-generated corner or boundary case"),
      source: "ai_generated",
      generated_by: getConfiguration().model,
    });
    if (tests.length >= 8) break;
  }

  if (tests.length === 0) {
    throw new Error("The hidden-test agent returned no valid non-duplicate cases.");
  }
  return tests;
}

async function generateHiddenTests({ title, statement, problemSpec, publicTests }) {
  const prompt = `You are the hidden-test designer for a deterministic C programming grader.
Generate 2 to 4 hidden test cases for the assignment below. They must target corner cases,
boundaries, invalid assumptions, overflow, empty/small/large inputs, or unusual valid input
formats as appropriate to the statement. Every expected output must be exact and computable from
the statement. Do not invent requirements that the statement does not define. Do not repeat any
public test. Return ONLY JSON in this shape:
{"hidden_tests":[{"id":"short_id","case":"short label","input":"exact stdin","expected":"exact stdout","description":"why this case matters"}]}

Title: ${title || "Untitled problem"}
Statement:
${statement || "No statement supplied"}
Problem specification:
${JSON.stringify(problemSpec || {}, null, 2)}
Public tests:
${JSON.stringify(publicTests || [], null, 2)}`;

  const generated = await generateJson(prompt, {
    generationOptions: { temperature: 0 },
  });
  const tests = validateGeneratedTests(generated, publicTests || []);
  return {
    tests,
    metadata: {
      status: "GENERATED",
      source: "ollama",
      model: getConfiguration().model,
      count: tests.length,
    },
  };
}

module.exports = {
  generateHiddenTests,
  validateGeneratedTests,
};
