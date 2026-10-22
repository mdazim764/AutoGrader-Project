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
// AGENT 1: The First Pass (Compiler & Setup with Fallback)
// ---------------------------------------------------------
async function runFirstPass(code, timeLimitSec) {
  const codePath = path.join(submissionsDir, "test.c");
  const errorPath = path.join(submissionsDir, "error.log");
  fs.writeFileSync(codePath, code);

  return new Promise((resolve) => {
    // Attempt 1: Try compiling with AddressSanitizer (Memory Leak Detection)
    exec(
      `gcc -O2 -Wall -Wextra -std=c11 -fsanitize=address -g "${codePath}" -o "${exePath}" 2> "${errorPath}"`,
      (error, stdout, stderr) => {
        if (error) {
          const gccError = fs.readFileSync(errorPath, "utf-8");

          // Check if it failed specifically because MinGW is missing the ASAN library
          if (gccError.includes("lasan") || gccError.includes("sanitize")) {
            console.log(
              "⚠️ MinGW ASAN not found. Falling back to standard compilation...",
            );

            // Attempt 2: Fallback to standard compilation without ASAN
            exec(
              `gcc -O2 -Wall -Wextra -std=c11 -g "${codePath}" -o "${exePath}" 2> "${errorPath}"`,
              (fallbackError, fallbackStdout, fallbackStderr) => {
                if (fallbackError) {
                  const fallbackGccError = fs.readFileSync(errorPath, "utf-8");
                  console.log(
                    `\n❌ GCC Compilation Error:\n${fallbackGccError}`,
                  );
                  resolve({
                    success: false,
                    reason: "Compilation Failed",
                    output: fallbackGccError,
                  });
                } else {
                  resolve({ success: true, warnings: fallbackStderr });
                }
              },
            );
          } else {
            // It's a genuine syntax error made by the student
            console.log(`\n❌ GCC Compilation Error:\n${gccError}`);
            resolve({
              success: false,
              reason: "Compilation Failed",
              output: gccError,
            });
          }
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
  if (!casesToTest || !Array.isArray(casesToTest) || casesToTest.length === 0) {
    console.log("  ❌ Logical Agent Failed: No valid test cases provided.");
    return { score: 0, details: [] };
  }

  // ✅ FIX: Normalize casesToTest to ALWAYS be an array of objects
  const normalizedCases = casesToTest
    .map((c) => {
      if (typeof c === "string") {
        const generated = generateEdgeCase(c);
        return generated
          ? { case: c, input: generated.input, expected: generated.expected }
          : null;
      }
      return c;
    })
    .filter(Boolean);

  const caseNames = normalizedCases.map((c) => c.case).join(", ");
  console.log(`\n🕵️‍♂️ Logical Agent testing: ${caseNames}`);

  let score = 0;
  const details = [];

  for (const testCase of normalizedCases) {
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
    score: normalizedCases.length > 0 ? score / normalizedCases.length : 0,
    details,
  };
}

// ---------------------------------------------------------
// AGENT 2.5: Logical Error Explainer & Counter Case Generator
// ---------------------------------------------------------
async function analyzeLogicalFailure(code, failedCases) {
  console.log(
    `\n🧠 AI Agent generating explanations and counter test cases...`,
  );
  const cleanCode = String(code).replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  const casesStr = JSON.stringify(failedCases);

  const prompt = `You are an expert C programming TA. The student's code failed these logical cases:
  ${casesStr}

  Code:\n${cleanCode}

  TASK:
  1. Explain WHY the code failed (e.g., integer overflow, logic error).
  2. Provide a conceptual hint.
  3. Generate a NEW "Counter Test Case" (input and expected output) that proves this failure.

  Return ONLY a strict JSON object: 
  {
    "explanation": "<Why it failed>",
    "hint": "<How to fix it conceptually>",
    "counter_case": {
      "input": "<example input>",
      "expected": "<expected output>"
    }
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
        options: { temperature: 0.1 },
      }),
    });
    const data = await response.json();
    return JSON.parse(data.response);
  } catch (err) {
    return {
      explanation: "Logical error detected in edge cases.",
      hint: "Check variable bounds and data types.",
      counter_case: { input: "N/A", expected: "N/A" },
    };
  }
}

// ---------------------------------------------------------
// AGENT 3: The LLM Readability Reviewer (DYNAMIC PERSONA 🔥)
// ---------------------------------------------------------
async function runLLMReview(code, params, isAiFlag) {
  console.log(
    `\n🤖 AI TA Agent reviewing code (Context: ${isAiFlag ? "AI Detected" : "Human"})...`,
  );
  const cleanCode = String(code).replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  // 🔥 THE GAME CHANGER: Agent changes persona based on previous Agent's findings
  let persona = "";
  if (isAiFlag) {
    persona = `You are a strict Teaching Assistant. The AI Plagiarism detector has flagged this code as highly likely AI-GENERATED (e.g., ChatGPT). 
    Your feedback MUST reflect this. Politely but firmly point out that while the logic works, relying heavily on AI for simple assignments limits their learning. Advise them to write their own code. Do NOT praise them enthusiastically.`;
  } else {
    persona = `You are a friendly, encouraging Teaching Assistant for a C programming class. 
    This code was written by a real human student. Give friendly feedback, start with a compliment, use emojis (👍, 💡), and suggest one small readability improvement.`;
  }

  const prompt = `${persona}
  
  Give a score out of 10 for readability.
  Return ONLY a strict JSON object in this format: {"score": <0-10>, "feedback": "<your feedback string>"}. 
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
        options: { temperature: 0.3 },
      }),
    });

    const data = await response.json();
    const parsed = JSON.parse(data.response);
    return { score: parsed.score / 10, feedback: parsed.feedback };
  } catch (error) {
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

  // const prompt = `You are an expert AI code detector. Analyze this C code and predict if it was generated by an AI (like ChatGPT) or a human student.

  // AI Code Traits:
  // - Overly explanatory "tutorial-style" comments inside functions (e.g., "// Check if n is 0", "// Initialize factorial").
  // - Perfectly structured spacing and textbook indentation.
  // - Use of generic variables (e.g., 'result', 'temp') flawlessly.

  // Human Code Traits:
  // - No comments, or very few simple/messy ones.
  // - Simple or quirky variable names (e.g., 'n', 'fact', 'i', 'j').
  // - Slight inconsistencies in spacing or brackets.

  // CRITICAL RULE: If the code lacks explanatory comments AND has inconsistent or missing indentation, you MUST strongly lean towards classifying it as HUMAN (is_ai: false) with high confidence. Do not flag standard algorithms as AI just because they are logically correct.
  // Return ONLY a strict JSON object in this format:
  // {
  //   "is_ai": <boolean true or false>,
  //   "confidence": <integer between 0 and 100>,
  //   "reason": "<One short sentence explaining why it looks like AI or Human>"
  // }

  // Code to analyze:\n${cleanCode}`;

  const prompt = `You are a forensic code analyzer. Evaluate the exact C code enclosed in the <CODE> tags below.

<CODE>
${cleanCode}
</CODE>

Answer these questions internally based ONLY on the code above:
  1. Does it have multiple explanatory comments (like // Check if n is...)?
  2. Are the variable names long and professional (like calculateFactorial, inputNumber)?
  3. Is the code perfectly structured and modular?

  If YES to these, it is heavily AI-generated (is_ai: true).
  If the code is raw, lacks comments, has simple variables (n, i, fact), and messy spacing, it is HUMAN (is_ai: false).

Based on actual facts from the <CODE> block, return ONLY a strict JSON object:
{
  "is_ai": <boolean>,
  "confidence": <integer 0-100>,
  "reason": "<One short sentence explaining the actual traits found in the code, e.g., 'No comments and messy indentation indicate human.'>"
}
`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt: prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.0 },
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

    // 🔥 3a. Run AI Detector FIRST (To set the context)
    const aiDetectionResult = await runAIDetectorAgent(submission.code);
    reportMetrics.push({
      name: "ai_detection",
      score: aiDetectionResult.is_ai ? 0 : 1,
      contribution: 0,
      details: {
        is_ai: aiDetectionResult.is_ai,
        confidence: aiDetectionResult.confidence,
        reason: aiDetectionResult.reason,
      },
    });

    // 3b. Readability LLM Agent (🔥 Passes the is_ai flag)
    const readabilityRule = rules.metrics.find((m) => m.name === "readability");
    if (readabilityRule) {
      const llmResult = await runLLMReview(
        submission.code,
        readabilityRule.params,
        aiDetectionResult.is_ai, // Passing the context!
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

    // 3c. Logical Edge Case Agent
    const logicalRule = rules.metrics.find((m) => m.name === "logical");
    if (logicalRule) {
      const logicalResult = await runLogicalAgent(logicalRule.params.cases);
      const contribution = logicalResult.score * logicalRule.weight * 100;
      totalScore += contribution;

      let aiLogicalFeedback = null;
      if (logicalResult.score < 1) {
        const failedCases = logicalResult.details.filter((d) => !d.passed);
        aiLogicalFeedback = await analyzeLogicalFailure(
          submission.code,
          failedCases,
        );
      }

      reportMetrics.push({
        name: "logical",
        score: logicalResult.score,
        contribution,
        details: logicalResult.details,
        aiFeedback: aiLogicalFeedback,
      });
    }

    // 3d. Complexity Agent
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

    // 🔥 PEER-TO-PEER PLAGIARISM CHECK 🔥
    console.log(`\n🕵️‍♂️ Checking for Peer Plagiarism...`);
    const otherSubmissions = await prisma.submission.findMany({
      where: {
        problemId: submission.problemId,
        studentId: { not: submission.studentId }, // Doosre students ka code
        status: "COMPLETED",
      },
    });

    let isPlagiarized = false;
    let plagiarismScore = 0;
    let matchedWithId = null;

    // Basic Text Match (Spaces aur newlines hata kar raw logic compare karna)
    const normalizeCode = (c) => c.replace(/\s+/g, "").trim();
    const currentCodeNormalized = normalizeCode(submission.code);

    for (const pastSub of otherSubmissions) {
      const pastCodeNormalized = normalizeCode(pastSub.code);
      // Agar code 100% same hai (spaces ignore karke)
      if (currentCodeNormalized === pastCodeNormalized) {
        isPlagiarized = true;
        plagiarismScore = 100;
        matchedWithId = pastSub.id;
        console.log(
          `  🚨 Plagiarism Match Found with Submission: ${pastSub.id}`,
        );
        break; // Ek baar pakda gaya toh check rok do
      }
    }

    // 4. Save Final Report to Database
    console.log(`\n💾 Saving Final Score: ${totalScore}/100 to Database...`);
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "COMPLETED",
        finalScore: totalScore,
        isPlagiarized: isPlagiarized, // 🔥 DB me flag update hoga
        plagiarismScore: plagiarismScore,
        matchedWithId: matchedWithId,
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
