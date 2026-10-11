const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const exePath = path.join(__dirname, "../submissions/test.exe");

async function runTestCase(testCase, timeLimitMs) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const child = spawn(exePath);

    let output = "";
    let isTimeout = false;

    const timer = setTimeout(() => {
      isTimeout = true;
      child.kill("SIGKILL");
      resolve({ passed: false, reason: "Timeout", runtime: timeLimitMs });
    }, timeLimitMs);

    child.stdout.on("data", (data) => (output += data.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      const endTime = performance.now();
      const runtimeMs = endTime - startTime;

      if (isTimeout) return;

      const actualOutput = output.trim();
      const expectedOutput = testCase.expected.trim();

      if (actualOutput === expectedOutput) {
        resolve({ passed: true, runtime: runtimeMs, output: actualOutput });
      } else {
        resolve({
          passed: false,
          reason: `Expected: ${expectedOutput}, Got: ${actualOutput}`,
          runtime: runtimeMs,
          output: actualOutput,
        });
      }
    });

    child.stdin.write(testCase.input + "\n");
    child.stdin.end();
  });
}

async function ioExpertAnalyzer(rules) {
  console.log(
    `\n🧠 Running IO & Logic Expert Analyzers for '${rules.problem}'...`,
  );

  // Find the correctness rules
  const correctnessRule = rules.metrics.find((m) => m.name === "correctness");
  if (!correctnessRule)
    return { error: "No correctness metrics found in rules." };

  const testDir = path.join(
    __dirname,
    "../",
    correctnessRule.params.testset_dir,
  );
  const timeLimitMs = rules.time_limit_s * 1000;

  // Read all JSON test cases from the directory
  const testFiles = fs.readdirSync(testDir).filter((f) => f.endsWith(".json"));

  let testsPassed = 0;
  const testDetails = [];
  const runtimes = [];

  for (const file of testFiles) {
    const testCase = JSON.parse(
      fs.readFileSync(path.join(testDir, file), "utf-8"),
    );
    const result = await runTestCase(testCase, timeLimitMs);

    runtimes.push(result.runtime);

    if (result.passed) {
      testsPassed++;
      console.log(
        `  ✅ Test '${testCase.id}': Passed in ${result.runtime.toFixed(2)}ms`,
      );
    } else {
      console.log(`  ❌ Test '${testCase.id}': Failed - ${result.reason}`);
    }

    testDetails.push({
      id: testCase.id,
      input: testCase.input,
      passed: result.passed,
      reason: result.reason || "Matched Expected Output",
    });
  }

  const totalTests = testFiles.length;
  const score = testsPassed / totalTests; // Example: 2/3 = 0.66
  const weightedScore = score * correctnessRule.weight;

  // Very basic complexity estimation (O(1) check)
  // If all tests run in roughly constant time (< 5ms variance), we assume O(1)
  const maxRuntime = Math.max(...runtimes);
  const estimatedComplexity = maxRuntime < 15 ? "O(1)" : "Needs deeper profile";
  console.log(`\n📈 Estimated Complexity: ${estimatedComplexity}`);

  return {
    metric: "correctness",
    tests_passed: testsPassed,
    tests_total: totalTests,
    raw_score: score,
    weighted_contribution: weightedScore,
    estimated_complexity: estimatedComplexity,
    details: testDetails,
  };
}

// Basic wrapper for independent testing
if (require.main === module) {
  const mockRules = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../rules/add_two_integers.json"),
      "utf-8",
    ),
  );
  ioExpertAnalyzer(mockRules).then((res) =>
    console.log("\nIO Analyzer Result:", res),
  );
}

module.exports = ioExpertAnalyzer;
