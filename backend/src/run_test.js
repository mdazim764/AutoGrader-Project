const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs"); // File system module for reading test files

// Paths define karna
const exePath = path.join(__dirname, "../submissions/test.exe");
const inputPath = path.join(__dirname, "../tests/01_basic.in");
const expectedOutputPath = path.join(__dirname, "../tests/01_basic.out");

// 1. Read Input and Expected Output from files
const inputData = fs.readFileSync(inputPath, "utf-8");
const expectedOutput = fs.readFileSync(expectedOutputPath, "utf-8").trim();

console.log("-----------------------------------------");
console.log(`Running test with input: ${inputData.trim()}`);
console.log("-----------------------------------------\n");

const child = spawn(exePath);

let output = "";
let errorOutput = "";
let isTimeout = false;

// Timeout Protection (2 seconds)
const TIME_LIMIT = 2000;
const timeoutTimer = setTimeout(() => {
  isTimeout = true;
  child.kill("SIGKILL");
  console.log(`❌ Time Limit Exceeded! Process killed after ${TIME_LIMIT}ms.`);
}, TIME_LIMIT);

// Capture Output
child.stdout.on("data", (data) => {
  output += data.toString();
});

// Capture Errors
child.stderr.on("data", (data) => {
  errorOutput += data.toString();
});

// 2. When Program Finishes
child.on("close", (code) => {
  clearTimeout(timeoutTimer);

  if (isTimeout) return;

  if (errorOutput) {
    console.log(`Runtime Error: \n${errorOutput}`);
    return;
  }

  // 3. The Core Verification Logic
  const actualOutput = output.trim();

  console.log(`Expected Output: ${expectedOutput}`);
  console.log(`Actual Output  : ${actualOutput}\n`);

  if (actualOutput === expectedOutput) {
    console.log("✅ Verdict: Test Case Passed! (10/10 Marks)");
  } else {
    console.log("❌ Verdict: Test Case Failed! (0/10 Marks)");
  }
});

// 4. Feed the file content to the C program
child.stdin.write(inputData);
child.stdin.end();
