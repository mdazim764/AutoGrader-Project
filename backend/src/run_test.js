const { spawn } = require("child_process");
const path = require("path");

const exePath = path.join(__dirname, "../submissions/test.exe");

console.log("Running the compiled C binary with Timeout Protection...\n");

const child = spawn(exePath);

let output = "";
let errorOutput = "";
let isTimeout = false;

// 1. SETTING THE TIME LIMIT (2000 ms = 2 Seconds)
const TIME_LIMIT = 2000;
const timeoutTimer = setTimeout(() => {
  isTimeout = true;
  child.kill("SIGKILL"); // Program ko zabardasti band karna
  console.log(`❌ Time Limit Exceeded! Process killed after ${TIME_LIMIT}ms.`);
}, TIME_LIMIT);

// Output Capture
child.stdout.on("data", (data) => {
  output += data.toString();
});

// Error Capture
child.stderr.on("data", (data) => {
  errorOutput += data.toString();
});

// 2. WHEN PROGRAM EXITS
child.on("close", (code) => {
  clearTimeout(timeoutTimer); // Agar program time se pehle chal gaya, toh timer cancel kar do

  console.log("--- Execution Finished ---");

  if (isTimeout) {
    // Timeout ka message upar pehle hi print ho chuka hai
    return;
  }

  console.log(`Exit Code: ${code}`);

  if (errorOutput) {
    console.log(`Runtime Error: \n${errorOutput}`);
  } else {
    console.log(`Program Output: ${output.trim()}`);
    if (output.trim() === "30") {
      console.log("✅ Test Case Passed!");
    } else {
      console.log("❌ Test Case Failed!");
    }
  }
});

// Feed input to trigger the infinite loop
child.stdin.write("10 20\n");
child.stdin.end();
