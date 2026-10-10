const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Paths
const exePath = path.join(__dirname, "../submissions/test.exe");
const codePath = path.join(__dirname, "../submissions/test.c");
const testCasesPath = path.join(__dirname, "../tests/testcases.json");
const reportJsonPath = path.join(__dirname, "../reports/report.json");
const reportTxtPath = path.join(__dirname, "../reports/report.txt");

// 1. I/O Test Runner (From Stage 2)
function runSingleTestCase(testCase) {
  return new Promise((resolve) => {
    const child = spawn(exePath);
    let output = "";
    let errorOutput = "";
    let isTimeout = false;

    const timer = setTimeout(() => {
      isTimeout = true;
      child.kill("SIGKILL");
      resolve({ passed: false, reason: "Time Limit Exceeded", score: 0 });
    }, 2000);

    child.stdout.on("data", (data) => (output += data.toString()));
    child.stderr.on("data", (data) => (errorOutput += data.toString()));

    child.on("close", () => {
      clearTimeout(timer);
      if (isTimeout) return;

      if (errorOutput) {
        resolve({
          passed: false,
          reason: `Runtime Error: ${errorOutput.trim()}`,
          score: 0,
        });
        return;
      }

      const actualOutput = output.trim();
      const expectedOutput = testCase.expected.trim();

      if (actualOutput === expectedOutput) {
        resolve({
          passed: true,
          reason: "Correct Output",
          score: testCase.weight,
        });
      } else {
        resolve({
          passed: false,
          reason: `Expected: ${expectedOutput}, Got: ${actualOutput}`,
          score: 0,
        });
      }
    });

    child.stdin.write(testCase.input + "\n");
    child.stdin.end();
  });
}

// 2. Ollama LLM Reviewer (From Stage 3)
async function analyzeReadability(code) {
  const prompt = `You are a strict C programming instructor. Review this code for readability and variable naming. Do NOT evaluate logic.
    Return ONLY a JSON object: {"score": <0-10>, "feedback": "<one short sentence>"}
    Code: \n${code}`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt: prompt,
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) return { score: 0, feedback: "LLM API Error" };
    const data = await response.json();
    return JSON.parse(data.response);
  } catch (error) {
    return { score: 0, feedback: "LLM Connection Failed" };
  }
}

// 3. The Main Coordinator Agent
async function mainAgent() {
  console.log("🚀 Starting Agentic AutoGrader...\n");

  // --- STEP A: Run I/O Tests ---
  console.log("⏳ [1/3] Running Deterministic I/O Tests...");
  const testCases = JSON.parse(fs.readFileSync(testCasesPath, "utf-8"));
  let ioScore = 0;
  let maxIoScore = 0;
  let testDetails = [];

  for (let tc of testCases) {
    maxIoScore += tc.weight;
    const result = await runSingleTestCase(tc);
    ioScore += result.score;
    testDetails.push({
      id: tc.id,
      description: tc.description,
      passed: result.passed,
      reason: result.reason,
      score: result.score,
    });
  }
  console.log(`✅ I/O Tests Completed! Score: ${ioScore}/${maxIoScore}\n`);

  // --- STEP B: Run LLM Review ---
  console.log("⏳ [2/3] Getting AI Code Review from Ollama...");
  const codeContent = fs.readFileSync(codePath, "utf-8");
  const llmReview = await analyzeReadability(codeContent);
  console.log(
    `✅ AI Review Completed! Readability Score: ${llmReview.score}/10\n`,
  );

  // --- STEP C: Generate Reports ---
  console.log("⏳ [3/3] Generating Final Reports...");

  // Create JSON Report
  const finalReport = {
    submission: "test.c",
    total_grade: ioScore,
    max_grade: maxIoScore,
    metrics: {
      correctness: testDetails,
      readability: llmReview,
    },
  };
  fs.writeFileSync(reportJsonPath, JSON.stringify(finalReport, null, 4));

  // Create Text Report (Format required by Assignment)
  const textReport = `
===== Grading Report for test.c =====
Overall Grade: ${ioScore}/${maxIoScore}

--- Metric: Correctness ---
${testDetails.map((t) => `Test ${t.id} (${t.description}):${t.passed ? "PASSED" : "FAILED - " + t.reason}`).join("\n")}

--- Metric: Readability (AI Review) ---
Score: ${llmReview.score}/10
Feedback: ${llmReview.feedback}
    `.trim();
  fs.writeFileSync(reportTxtPath, textReport);

  console.log(
    "🎉 SUCCESS: report.json and report.txt saved in 'backend/reports/' folder!",
  );
}

mainAgent();
