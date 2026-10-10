const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const exePath = path.join(__dirname, "../submissions/test.exe");
const testCasesPath = path.join(__dirname, "../tests/testcases.json");

// 1. JSON file se saare test cases read karna
const testCases = JSON.parse(fs.readFileSync(testCasesPath, "utf-8"));

// 2. Ek function jo sirf EK test case run karega aur Promise return karega
function runSingleTestCase(testCase) {
  return new Promise((resolve) => {
    const child = spawn(exePath);
    let output = "";
    let errorOutput = "";
    let isTimeout = false;

    // Timeout Protection
    const timer = setTimeout(() => {
      isTimeout = true;
      child.kill("SIGKILL");
      resolve({
        passed: false,
        reason: "Time Limit Exceeded (Infinite Loop)",
        earnedWeight: 0,
      });
    }, 2000);

    child.stdout.on("data", (data) => (output += data.toString()));
    child.stderr.on("data", (data) => (errorOutput += data.toString()));

    child.on("close", () => {
      clearTimeout(timer);
      if (isTimeout) return; // Agar timeout hua toh pehle hi resolve ho chuka hai

      if (errorOutput) {
        resolve({
          passed: false,
          reason: `Runtime Error: ${errorOutput.trim()}`,
          earnedWeight: 0,
        });
        return;
      }

      const actualOutput = output.trim();
      const expectedOutput = testCase.expected.trim();

      if (actualOutput === expectedOutput) {
        resolve({
          passed: true,
          reason: "Correct Output",
          earnedWeight: testCase.weight,
        });
      } else {
        resolve({
          passed: false,
          reason: `Wrong Answer. Expected: ${expectedOutput}, Got: ${actualOutput}`,
          earnedWeight: 0,
        });
      }
    });

    // Test case ka input C program ko bhejna
    child.stdin.write(testCase.input + "\n");
    child.stdin.end();
  });
}

// 3. Main Loop jo saare test cases ko ek-ek karke chalayega
async function runAllTests() {
  console.log(
    `Starting AutoGrader Engine...\nFound ${testCases.length} Test Cases.\n`,
  );

  let totalScore = 0;
  let maxScore = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    maxScore += tc.weight;

    // await lagane se agla test tabhi chalega jab ye wala poora ho jayega
    const result = await runSingleTestCase(tc);

    if (result.passed) {
      totalScore += result.earnedWeight;
      console.log(
        `Test [${tc.id}] (${tc.description}): ✅ PASSED (+${result.earnedWeight} pts)`,
      );
    } else {
      console.log(
        `Test [${tc.id}] (${tc.description}): ❌ FAILED - ${result.reason}`,
      );
    }
  }

  console.log("\n=================================");
  console.log(`FINAL I/O SCORE: ${totalScore} / ${maxScore}`);
  console.log("=================================\n");
}

// Execution Start
runAllTests();
