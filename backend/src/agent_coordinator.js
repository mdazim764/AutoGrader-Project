require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");
const { performance } = require("perf_hooks");

// Database Initialization (Prisma 7 format)
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const submissionsDir = path.join(__dirname, "../submissions");
const exePath = path.join(submissionsDir, "test.exe");

// Ensure submissions directory exists
if (!fs.existsSync(submissionsDir)) {
  fs.mkdirSync(submissionsDir, { recursive: true });
}

// ---------------------------------------------------------
// AGENT 1: The First Pass (Compiler & Setup)
// ---------------------------------------------------------
async function runFirstPass(code, timeLimitSec) {
  const codePath = path.join(submissionsDir, "test.c");
  fs.writeFileSync(codePath, code);

  return new Promise((resolve) => {
    exec(
      `gcc -O2 -Wall -Wextra -std=c11 "${codePath}" -o "${exePath}"`,
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            reason: "Compilation Failed",
            details: stderr,
          });
        } else {
          resolve({ success: true, warnings: stderr });
        }
      },
    );
  });
}

// ---------------------------------------------------------
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
  console.log(`\n🕵️‍♂️ Logical Agent testing: ${casesToTest.join(", ")}`);
  let score = 0;
  const details = [];

  for (const caseType of casesToTest) {
    const testCase = generateEdgeCase(caseType);
    if (!testCase) continue;

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
          passed: actualOutput === testCase.expected,
          got: actualOutput,
        });
      });
      child.stdin.write(testCase.input + "\n");
      child.stdin.end();
    });

    if (result.passed) score++;
    details.push({
      case: caseType,
      passed: result.passed,
      got: result.got || "Timeout",
    });
    console.log(
      `  ${result.passed ? "✅" : "❌"} ${caseType}: ${result.passed ? "Passed" : `Got ${result.got}`}`,
    );
  }

  return {
    score: casesToTest.length > 0 ? score / casesToTest.length : 0,
    details,
  };
}

// ---------------------------------------------------------
// AGENT 3: The LLM Readability Reviewer
// ---------------------------------------------------------
async function runLLMReview(code, params) {
  console.log(`\n🤖 AI Agent reviewing code using ${params.model}...`);
  const cleanCode = String(code).replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  const prompt = `You are a strict C programming instructor. Review this code for readability, variable naming, and comments. Give a score out of 10. Return ONLY a JSON object in this format: {"score": <0-10>, "feedback": "<one short sentence>"}. Code:\n${cleanCode}`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: params.model || "llama3.1:8b",
        prompt: prompt,
        stream: false,
        format: "json",
        options: { temperature: params.temperature || 0 },
      }),
    });

    if (!response.ok) throw new Error("Ollama API failed");
    const data = await response.json();
    const parsed = JSON.parse(data.response);

    console.log(`  ✅ AI Score: ${parsed.score}/10 - ${parsed.feedback}`);
    // Return score as a percentage (0.0 to 1.0) for easy weight multiplication
    return { score: parsed.score / 10, feedback: parsed.feedback };
  } catch (error) {
    console.log("  ❌ LLM Offline or Failed:", error.message);
    return { score: 0, feedback: "AI Review failed." };
  }
}

// ---------------------------------------------------------
// AGENT 4: The Complexity Estimator (AI Static Analysis)
// ---------------------------------------------------------
async function runComplexityAgent(code, requiredComplexity) {
  console.log(
    `\n⏱️ AI analyzing Time Complexity (Target: ${requiredComplexity})...`,
  );
  const cleanCode = String(code).replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  // We ask the LLM to act as an algorithmic analyzer
  const prompt = `Analyze the time complexity of this C code. Look at the number of loops, nested loops, and step executions. Return ONLY a strict JSON object in this format: {"estimated": "<Big-O notation, e.g., O(1), O(N), O(N^2)>", "reason": "<one short sentence explaining why>"}. Code:\n${cleanCode}`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b", // Make sure this matches your model
        prompt: prompt,
        stream: false,
        format: "json",
        options: { temperature: 0 },
      }),
    });

    if (!response.ok) throw new Error("Ollama API failed");
    const data = await response.json();
    const parsed = JSON.parse(data.response);

    // Remove spaces for strict matching (e.g., "O( 1 )" -> "O(1)")
    const estClean = parsed.estimated.replace(/\s/g, "").toUpperCase();
    const reqClean = requiredComplexity.replace(/\s/g, "").toUpperCase();

    console.log(`  📈 AI Estimated: ${estClean} (Reason: ${parsed.reason})`);

    let score = 0;
    let feedback = `Expected ${requiredComplexity}, Got ${parsed.estimated}. ${parsed.reason}`;

    if (estClean === reqClean) {
      score = 1.0;
      feedback = `Passed! Complexity is ${parsed.estimated}. ${parsed.reason}`;
    }

    // Return empty runs array to not break the frontend UI
    return {
      score,
      estimated: parsed.estimated,
      feedback,
      details: { runs: [] },
    };
  } catch (error) {
    console.log("  ❌ Complexity Agent Failed:", error.message);
    return {
      score: 0,
      estimated: "Unknown",
      feedback: "Complexity analysis failed.",
      details: { runs: [] },
    };
  }
}

// ---------------------------------------------------------
// MASTER COORDINATOR: Database Fetch & Execute
// ---------------------------------------------------------
async function gradeSubmission(submissionId) {
  console.log(
    `\n🚀 Starting Agentic AutoGrader for Submission: ${submissionId}`,
  );

  try {
    // 1. Fetch Submission & Problem Rules from Database
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { problem: true },
    });

    if (!submission) throw new Error("Submission not found!");

    // Mark as grading
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "GRADING" },
    });

    console.log(`📋 Loaded Rules for: ${submission.problem.title}`);
    const rules = submission.problem.rules; // The JSONB rules!

    // 2. Run First Pass (Compile)
    const firstPass = await runFirstPass(
      submission.code,
      submission.problem.timeLimitSec,
    );
    if (!firstPass.success) {
      console.log("❌ Compilation Failed. Halting.");
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "FAILED", finalScore: 0, report: { firstPass } },
      });
      return;
    }

    // 3. Dispatch Experts Based on DB Rules
    let totalScore = 0;
    const reportMetrics = [];

    // 3a. Logical Edge Case Agent
    const logicalRule = rules.metrics.find((m) => m.name === "logical");
    if (logicalRule) {
      const logicalResult = await runLogicalAgent(logicalRule.params.cases);
      const contribution = logicalResult.score * logicalRule.weight * 100;
      totalScore += contribution;
      reportMetrics.push({
        name: "logical",
        score: logicalResult.score,
        contribution,
        details: logicalResult.details,
      });
    }

    // 3b. Readability LLM Agent
    const readabilityRule = rules.metrics.find((m) => m.name === "readability");
    if (readabilityRule) {
      const llmResult = await runLLMReview(
        submission.code,
        readabilityRule.params,
      );
      const contribution = llmResult.score * readabilityRule.weight * 100;
      totalScore += contribution;

      reportMetrics.push({
        name: "readability",
        score: llmResult.score,
        contribution,
        details: { feedback: llmResult.feedback },
      });
    }

    // 3c. Complexity Agent
    const complexityRule = rules.metrics.find((m) => m.name === "complexity");
    if (complexityRule) {
      const compResult = await runComplexityAgent(
        submission.code,
        complexityRule.params.required,
      );
      const contribution = compResult.score * complexityRule.weight * 100;
      totalScore += contribution;

      reportMetrics.push({
        name: "complexity",
        score: compResult.score,
        contribution,
        details: {
          estimated: compResult.estimated,
          feedback: compResult.feedback,
          runs: compResult.details,
        },
      });
    }

    // 4. Save Final Report to Database
    console.log(`\n💾 Saving Final Score: ${totalScore}/100 to Database...`);
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "COMPLETED",
        finalScore: totalScore,
        report: { firstPass, metrics: reportMetrics },
      },
    });

    console.log("✅ AutoGrader Complete!");
  } catch (error) {
    console.error("Error during grading:", error);
  }
}

// Mock Run (Fetches the FIRST pending submission from DB and grades it)
async function testRun() {
  const pending = await prisma.submission.findFirst({
    where: { status: "PENDING" },
  });
  if (pending) {
    await gradeSubmission(pending.id);
  } else {
    console.log("No pending submissions found to test.");
    await prisma.$disconnect();
    await pool.end();
  }
}

// if (require.main === module) {
//   testRun();
// }
module.exports = { gradeSubmission };
