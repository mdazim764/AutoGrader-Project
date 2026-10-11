const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Paths configuration
const codePath = path.join(__dirname, "../submissions/test.c");
const exePath = path.join(__dirname, "../submissions/test.exe");
const rulesPath = path.join(__dirname, "../rules/add_two_integers.json");
const testCasesPath = path.join(__dirname, "../tests/testcases.json"); // Reusing existing tests for the smoke run

async function runFirstPass() {
  console.log("🛠️ Starting 'First Pass' Checks...");

  // 1. Load the dynamic rules
  let rules;
  try {
    rules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
    console.log(`✅ Loaded rules for problem: ${rules.problem}`);
  } catch (e) {
    console.error("❌ Failed to load rules file.");
    return { success: false, reason: "Missing or invalid rules file." };
  }

  const timeLimitMs = rules.time_limit_s * 1000;

  // Extract compiler flags from rules if they exist, otherwise use defaults
  const syntaxMetric = rules.metrics.find((m) => m.name === "syntax");
  const compilerFlags = syntaxMetric?.params?.flags || "-Wall -Wextra -std=c11";

  // 2. Compile Check
  console.log(`⏳ Compiling with flags: ${compilerFlags}...`);
  const compileResult = await new Promise((resolve) => {
    exec(
      `gcc ${compilerFlags} "${codePath}" -o "${exePath}"`,
      (error, stdout, stderr) => {
        if (error) {
          // If -Werror is used, warnings will cause an error
          resolve({
            success: false,
            reason: "Compilation Failed",
            output: stderr,
          });
        } else {
          resolve({ success: true, warnings: stderr });
        }
      },
    );
  });

  if (!compileResult.success) {
    console.log(`❌ Compilation Error:\n${compileResult.output}`);
    return {
      success: false,
      reason: "Compilation failed",
      details: compileResult.output,
    };
  }
  console.log("✅ Compilation Successful!");

  // 3. Smoke Run Check
  console.log(`⏳ Running Smoke Test (Time Limit: ${timeLimitMs}ms)...`);

  // Need sample input for the smoke run. We'll grab the first one from our tests.
  let smokeInput = "10 20";
  try {
    const testCases = JSON.parse(fs.readFileSync(testCasesPath, "utf-8"));
    if (testCases.length > 0) smokeInput = testCases[0].input;
  } catch (e) {
    // Fallback to default if test file not found
  }

  const smokeResult = await new Promise((resolve) => {
    const child = spawn(exePath);
    let isTimeout = false;

    const timer = setTimeout(() => {
      isTimeout = true;
      child.kill("SIGKILL");
      resolve({ success: false, reason: "Timeout (Suspected Infinite Loop)" });
    }, timeLimitMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (isTimeout) return;
      if (code !== 0) {
        resolve({ success: false, reason: `Crash (Exit code ${code})` });
      } else {
        resolve({ success: true });
      }
    });

    // Feed the sample input
    child.stdin.write(smokeInput + "\n");
    child.stdin.end();
  });

  if (!smokeResult.success) {
    console.log(`❌ Smoke Run Failed: ${smokeResult.reason}`);
    return { success: false, reason: smokeResult.reason };
  }

  console.log("✅ Smoke Run Successful!");

  // 4. Static Sanity Check (Very basic regex for now)
  const sourceCode = fs.readFileSync(codePath, "utf-8");
  if (!sourceCode.includes("main(") || !sourceCode.includes("return 0;")) {
    console.log("⚠️ Static Sanity Warning: Missing standard main structure.");
    // Could fail here, but we'll just log a warning for this basic check
  }

  return {
    success: true,
    rules: rules, // Return the loaded rules so the coordinator can use them
  };
}

// Simple test wrapper just for this file
if (require.main === module) {
  runFirstPass().then((res) => console.log("\nFirst Pass Result:", res));
}

module.exports = runFirstPass;
