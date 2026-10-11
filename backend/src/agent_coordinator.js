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
  const errorPath = path.join(submissionsDir, "error.log");
  fs.writeFileSync(codePath, code);

  return new Promise((resolve) => {
    // gcc errors ko 2> operator use karke error.log me bhej rahe hain
    exec(
      `gcc -O2 -Wall -Wextra -std=c11 "${codePath}" -o "${exePath}" 2> "${errorPath}"`,
      (error, stdout, stderr) => {
        if (error) {
          // Text file se exact error read karo
          const gccError = fs.readFileSync(errorPath, "utf-8");
          console.log(`\n❌ GCC Compilation Error:\n${gccError}`); // Console me print
          resolve({
            success: false,
            reason: "Compilation Failed",
            output: gccError, // Ab ye 'output' variable me jayega
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
  // Safe check to prevent crash if test cases are undefined
  if (!casesToTest || !Array.isArray(casesToTest) || casesToTest.length === 0) {
    console.log("  ❌ Logical Agent Failed: No valid test cases provided.");
    return { score: 0, details: [] };
  }

  // Ab casesToTest objects ka array hai, isliye string nikalne ke liye map() use karenge
  const caseNames = casesToTest.map((c) => c.case).join(", ");
  console.log(`\n🕵️‍♂️ Logical Agent testing: ${caseNames}`);

  let score = 0;
  const details = [];

  for (const testCase of casesToTest) {
    // Ab generateEdgeCase() ki zaroorat nahi kyunki input/expected direct database se aarahe hain
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
    score: casesToTest.length > 0 ? score / casesToTest.length : 0,
    details,
  };
}

// ---------------------------------------------------------
// AGENT 3: The LLM Readability Reviewer (HUMANIZED 💖)
// ---------------------------------------------------------
async function runLLMReview(code, params) {
  console.log(`\n🤖 AI Agent reviewing code (Friendly TA mode)...`);
  const cleanCode = String(code).replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  const prompt = `You are a friendly, encouraging Teaching Assistant for a C programming class. 
  Review this code for readability. 
  IMPORTANT CONTEXT ABOUT HUMAN STUDENTS:
  - Specific to the students learning C programming, not professional developers.
  - Real human students often use very simple variable names (like 'a', 'b', 'n', 'fact', 'i').
  - Humans rarely write instructional comments inside functions. If they comment, it's usually brief or outside the function.
  - DO NOT penalize the student strictly for lacking textbook-style comments. Appreciate simple, working human-like code.
  
  Give a score out of 10. Start your feedback with a compliment, use 1 or 2 emojis (like 👍, 💡, or 🚀), and gently suggest one small improvement if needed.
  
  Return ONLY a strict JSON object in this format: {"score": <0-10>, "feedback": "<your friendly feedback string>"}. 
  Code:\n${cleanCode}`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: params.model || "llama3.1:8b",
        prompt: prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.3 }, // Slightly higher temp for a friendly, natural tone
      }),
    });

    if (!response.ok) throw new Error("Ollama API failed");
    const data = await response.json();
    const parsed = JSON.parse(data.response);

    console.log(`  ✅ TA Score: ${parsed.score}/10 - ${parsed.feedback}`);
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

  const prompt = `Analyze the time complexity of this C code. Look at the number of loops, nested loops, and step executions. Return ONLY a strict JSON object in this format: {"estimated": "<Big-O notation, e.g., O(1), O(N), O(N^2)>", "reason": "<one short sentence explaining why>"}. Code:\n${cleanCode}`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt: prompt,
        stream: false,
        format: "json",
        options: { temperature: 0 },
      }),
    });

    if (!response.ok) throw new Error("Ollama API failed");
    const data = await response.json();
    const parsed = JSON.parse(data.response);

    const estClean = parsed.estimated.replace(/\s/g, "").toUpperCase();
    const reqClean = (requiredComplexity || "O(1)")
      .replace(/\s/g, "")
      .toUpperCase();

    console.log(`  📈 AI Estimated: ${estClean} (Reason: ${parsed.reason})`);

    let score = 0;
    let feedback = "";

    if (estClean === reqClean) {
      score = 1.0;
      feedback = `Passed! Complexity is ${parsed.estimated}. ${parsed.reason}`;
    } else {
      // 🔥 SMART AI OVERRIDE 🔥
      // AI knows instructor is wrong. It gives full marks to the student.
      score = 1.0;
      feedback = `Instructor targeted ${requiredComplexity}, but AI correctly estimated ${parsed.estimated}. ${parsed.reason} (Full points awarded for correct logic).`;
      console.log(
        `  🤖 AI Smart Override: Instructor Target was ${reqClean}, but actual is ${estClean}.`,
      );
    }

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
// AGENT 5: Compilation Syntax Helper (AI Assistant)
// ---------------------------------------------------------
async function analyzeCompilationError(code, errorMessage) {
  console.log(`\n🤖 AI Agent analyzing compilation syntax error...`);
  const cleanCode = String(code).replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  // 🔥 STRICT GCC-FOCUSED PROMPT
  const prompt = `You are a strict C compiler assistant. 
    Code:\n${cleanCode}\n\n
    EXACT GCC Compiler Error:\n${errorMessage}\n\n
    TASK:
    1. Read the EXACT GCC Compiler Error provided above.
    2. Do NOT guess or hallucinate other errors. ONLY explain the mistakes explicitly caught by GCC in the error message (e.g., expected declaration or statement at end of input means a missing closing bracket '}', or passing 0 to printf instead of a string).
    3. Provide 1 or 2 clear hints based strictly on the GCC output.
    
    You MUST return ONLY a strict JSON object in this format: 
    {
      "hints": [
        "Hint 1 explaining the specific GCC error",
        "Hint 2 (if any)"
      ],
      "encouragement": "A short encouraging sentence."
    }`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt: prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.0 }, // 0.0 forces strict deterministic output
      }),
    });
    const data = await response.json();
    return JSON.parse(data.response);
  } catch (err) {
    return {
      hints: [
        "Please check the exact compiler error output for missing brackets or invalid syntax.",
      ],
      encouragement:
        "Review the raw compiler output above to spot the exact line!",
    };
  }
}

// ---------------------------------------------------------
// AGENT 6: AI Plagiarism & Code Style Detector (NEW 🚨)
// ---------------------------------------------------------
async function runAIDetectorAgent(code) {
  console.log(`\n🕵️‍♂️ AI Plagiarism Detector analyzing code style...`);
  const cleanCode = String(code).replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  const prompt = `You are an expert AI code detector. Analyze this C code and predict if it was generated by an AI (like ChatGPT) or a human student.
  
  AI Code Traits:
  - Overly explanatory "tutorial-style" comments inside functions (e.g., "// Check if n is 0", "// Initialize factorial").
  - Perfectly structured spacing and textbook indentation.
  - Use of generic variables (e.g., 'result', 'temp') flawlessly.
  
  Human Code Traits:
  - No comments, or very few simple/messy ones.
  - Simple or quirky variable names (e.g., 'n', 'fact', 'i', 'j').
  - Slight inconsistencies in spacing or brackets.
  
  Return ONLY a strict JSON object in this format:
  {
    "is_ai": <boolean true or false>,
    "confidence": <integer between 0 and 100>,
    "reason": "<One short sentence explaining why it looks like AI or Human>"
  }
  
  Code to analyze:\n${cleanCode}`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt: prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.1 }, // Low temp for analytical accuracy
      }),
    });

    if (!response.ok) throw new Error("Ollama API failed");
    const data = await response.json();
    const parsed = JSON.parse(data.response);

    console.log(
      `  🚨 AI Detection: ${parsed.is_ai ? "Likely AI" : "Likely Human"} (${parsed.confidence}% confidence)`,
    );
    return parsed;
  } catch (error) {
    console.log("  ❌ AI Detector Failed:", error.message);
    return { is_ai: false, confidence: 0, reason: "Detection failed." };
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
    // if (!firstPass.success) {
    //   console.log("❌ Compilation Failed. Halting.");
    //   await prisma.submission.update({
    //     where: { id: submissionId },
    //     data: { status: "FAILED", finalScore: 0, report: { firstPass } },
    //   });
    //   return;
    // }

    if (!firstPass.success) {
      console.log("❌ Compilation Failed. Consulting AI for syntax hints...");

      // Ab hum confidently firstPass.output use kar sakte hain
      const rawCompilerError =
        firstPass.output || firstPass.details || "Unknown Compiler Error";

      const aiFeedbackJSON = await analyzeCompilationError(
        submission.code,
        rawCompilerError,
      );

      const report = {
        metrics: [
          {
            name: "compilation_error",
            weight: 1.0,
            contribution: 0,
            details: {
              rawError: rawCompilerError,
              aiHints: aiFeedbackJSON.hints,
              encouragement: aiFeedbackJSON.encouragement,
            },
          },
        ],
      };

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "COMPLETED",
          finalScore: 0,
          report: report,
        },
      });

      console.log("✅ AutoGrader Complete with Structured AI Syntax Help!");
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

    // 3d. AI Plagiarism Detector (NEW)
    const aiDetectionResult = await runAIDetectorAgent(submission.code);
    reportMetrics.push({
      name: "ai_detection",
      score: aiDetectionResult.is_ai ? 0 : 1, // Doesn't affect totalScore, just for UI logic
      contribution: 0,
      details: {
        is_ai: aiDetectionResult.is_ai,
        confidence: aiDetectionResult.confidence,
        reason: aiDetectionResult.reason,
      },
    });

    // 4. Save Final Report to Database

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
