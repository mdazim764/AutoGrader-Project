const { spawn, exePath } = require("./runtime");
// AGENT 2: The Edge Case Logic Tester (In-Memory)
// ---------------------------------------------------------
function generateEdgeCase(caseType) {
  switch (caseType) {
    case "basic":
      return { input: "10 20", expected: "30", desc: "Basic positive" };
    case "zero":
      return { input: "0 0", expected: "0", desc: "Zero values" };
    case "negatives":
      return { input: "-50 -150", expected: "-200", desc: "Negative values" };
    case "int_overflow":
      return {
        input: "2147483647 1",
        expected: "-2147483648",
        desc: "INT_MAX overflow",
      };
    default:
      return null;
  }
}

async function runLogicalAgent(casesToTest) {
  if (!casesToTest || !Array.isArray(casesToTest) || casesToTest.length === 0) {
    console.log("  ❌ Logical Agent Failed: No valid test cases provided.");
    return { score: 0, details: [] };
  }

  // ✅ FIX: Normalize casesToTest to ALWAYS be an array of objects
  const normalizedCases = casesToTest
    .map((c) => {
      if (typeof c === "string") {
        const generated = generateEdgeCase(c);
        return generated
          ? { case: c, input: generated.input, expected: generated.expected }
          : null;
      }
      return c;
    })
    .filter(Boolean);

  const caseNames = normalizedCases.map((c) => c.case).join(", ");
  console.log(`\n🕵️‍♂️ Logical Agent testing: ${caseNames}`);

  let score = 0;
  const details = [];

  for (const testCase of normalizedCases) {
    if (!testCase.input || !testCase.expected) continue;

    const result = await new Promise((resolve) => {
      const child = spawn(exePath);
      let output = "";
      let isTimeout = false;

      const timer = setTimeout(() => {
        isTimeout = true;
        child.kill("SIGKILL");
        resolve({ passed: false, reason: "Timeout" });
      }, 1000);

      child.stdout.on("data", (data) => (output += data.toString()));

      child.on("close", () => {
        clearTimeout(timer);
        if (isTimeout) return;
        const actualOutput = output.trim();
        resolve({
          passed: actualOutput === testCase.expected.trim(),
          got: actualOutput,
        });
      });
      child.stdin.write(testCase.input + "\n");
      child.stdin.end();
    });

    if (result.passed) score++;
    details.push({
      case: testCase.case,
      passed: result.passed,
      got: result.got || "Timeout",
    });
    console.log(
      `  ${result.passed ? "✅" : "❌"} ${testCase.case}: ${result.passed ? "Passed" : `Got ${result.got}`}`,
    );
  }

  return {
    score: normalizedCases.length > 0 ? score / normalizedCases.length : 0,
    details,
  };
}

// ---------------------------------------------------------

module.exports = { generateEdgeCase, runLogicalAgent };

