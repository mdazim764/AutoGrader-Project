const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const codePath = path.join(__dirname, "../submissions/test.c");
const exePath = path.join(__dirname, "../submissions/test.exe");

// ✅ FIX 1: Accept the actual student code and time limit as parameters
async function runFirstPass(studentCode, timeLimitSec = 1) {
  console.log("🛠️ Starting 'First Pass' Checks...");

  // ✅ FIX 2: Write the FRESH student code to test.c before compiling!
  if (studentCode) {
    fs.writeFileSync(codePath, studentCode, "utf-8");
    console.log("📝 Saved fresh submission to test.c");
  }

  const timeLimitMs = timeLimitSec * 1000;
  const compilerFlags = "-Wall -Wextra -std=c11"; // Default flags

  // 2. Compile Check
  console.log(`⏳ Compiling with flags: ${compilerFlags}...`);
  const compileResult = await new Promise((resolve) => {
    exec(
      `gcc ${compilerFlags} "${codePath}" -o "${exePath}"`,
      (error, stdout, stderr) => {
        if (error) {
          // THIS IS THE FIX: Explicitly capture stderr
          const gccError =
            stderr ||
            stdout ||
            error.message ||
            "Compilation failed without specific output.";
          resolve({
            success: false,
            reason: "Compilation Failed",
            output: gccError,
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
      error: compileResult.output, // Ensure this maps to the 'error' property
      details: compileResult.output,
    };
  }
  console.log("✅ Compilation Successful!");
  console.log("✅ Compilation Successful!");

  // 3. Smoke Run Check
  console.log(`⏳ Running Smoke Test (Time Limit: ${timeLimitMs}ms)...`);
  let smokeInput = "10\n"; // Safe default input

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

    child.stdin.write(smokeInput);
    child.stdin.end();
  });

  if (!smokeResult.success) {
    console.log(`❌ Smoke Run Failed: ${smokeResult.reason}`);
    return {
      success: false,
      reason: "Smoke Test Failed",
      error: `The code compiled successfully, but crashed or timed out when executing. Reason: ${smokeResult.reason}`,
    };
  }

  console.log("✅ Smoke Run Successful!");
  return { success: true };
}

module.exports = runFirstPass;
