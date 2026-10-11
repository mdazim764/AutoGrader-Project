const { spawn } = require("child_process");
const path = require("path");

const exePath = path.join(__dirname, "../submissions/test.exe");

// 1. Agent's Knowledge Base: Ye function dynamically inputs banata hai based on rules
function generateEdgeCase(caseType) {
  switch (caseType) {
    case "zero":
      return { input: "0 0", expected: "0", desc: "Zero values" };
    case "negatives":
      return { input: "-50 -150", expected: "-200", desc: "Negative values" };
    case "int_overflow":
      // Standard 32-bit integer overflow logic
      return {
        input: "2147483647 1",
        expected: "-2147483648",
        desc: "INT_MAX overflow handling",
      };
    default:
      return null;
  }
}

async function runDynamicTest(testCase) {
  return new Promise((resolve) => {
    const child = spawn(exePath);
    let output = "";
    let isTimeout = false;

    const timer = setTimeout(() => {
      isTimeout = true;
      child.kill("SIGKILL");
      resolve({ passed: false, reason: "Timeout (Suspected Infinite Loop)" });
    }, 1000); // 1 sec strict limit

    child.stdout.on("data", (data) => (output += data.toString()));

    child.on("close", () => {
      clearTimeout(timer);
      if (isTimeout) return;

      const actualOutput = output.trim();
      if (actualOutput === testCase.expected) {
        resolve({ passed: true, reason: "Handled perfectly" });
      } else {
        resolve({
          passed: false,
          reason: `Fails. Expected: ${testCase.expected}, Got: ${actualOutput}`,
        });
      }
    });

    child.stdin.write(testCase.input + "\n");
    child.stdin.end();
  });
}

async function logicalEdgeCaseAgent(rules) {
  console.log(`\n🕵️‍♂️ Starting Agentic Edge Case Runner...`);

  // DB ya Rules API se aaya hua logical metric dhoondo
  const logicalRule = rules.metrics.find((m) => m.name === "logical");
  if (!logicalRule) return { error: "No logical metrics found." };

  const casesToTest = logicalRule.params.cases; // e.g. ["negatives", "zero", "int_overflow"]
  console.log(`📋 Instructor requested tests for: ${casesToTest.join(", ")}`);

  let score = 0;
  const testDetails = [];

  for (const caseType of casesToTest) {
    // Agent generates the test data on the fly (No physical files!)
    const testCase = generateEdgeCase(caseType);
    if (!testCase) continue;

    console.log(`  ⏳ Testing '${caseType}' -> Input: [${testCase.input}]`);
    const result = await runDynamicTest(testCase);

    if (result.passed) {
      score++;
      console.log(`  ✅ Result: PASSED`);
    } else {
      console.log(`  ❌ Result: FAILED - ${result.reason}`);
    }

    testDetails.push({
      case_type: caseType,
      input: testCase.input,
      passed: result.passed,
      feedback: result.reason,
    });
  }

  const finalRawScore = score / casesToTest.length; // e.g. 2/3 = 0.66
  const finalWeighted = finalRawScore * logicalRule.weight;

  return {
    metric: "logical",
    score: finalRawScore,
    weighted_contribution: finalWeighted,
    details: testDetails,
  };
}

// Temporary mock rule to simulate Database/Instructor payload
if (require.main === module) {
  const mockDbRule = {
    metrics: [
      {
        name: "logical",
        weight: 0.1,
        params: { cases: ["negatives", "zero", "int_overflow"] },
      },
    ],
  };
  logicalEdgeCaseAgent(mockDbRule).then((res) =>
    console.log("\nAgent Report:", JSON.stringify(res, null, 2)),
  );
}

module.exports = logicalEdgeCaseAgent;
