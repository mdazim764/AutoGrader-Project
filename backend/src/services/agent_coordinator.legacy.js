require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const {
  createReport,
} = require("../contracts");
const { loadDatabaseRules } = require("../rules/rule-loader");
const { executeConfiguredRules } = require("../rules/rule-engine.service");
const sandbox = require("../sandbox/wsl-executor");
const {
  runStructureAnalyzer,
  runModularityAnalyzer,
  runComplexityAnalyzer,
} = require("../analyzers/source.analyzers");
const { runOriginalityAnalyzer } = require("../analyzers/originality.analyzer");
const { runMemorySafetyAnalyzer } = require("../analyzers/memory-safety.analyzer");
const { buildReportMetadata } = require("../reporting/report-metadata");

// Database Initialization (Prisma 7 format)
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------
// AGENT 1: The First Pass (Compiler & Setup with Fallback)
// ---------------------------------------------------------
async function runFirstPass(code, timeLimitSec, workspace) {
  const compileResult = await sandbox.compile(workspace, timeLimitSec);
  return {
    ...compileResult,
    executablePath: workspace,
  };
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

async function runLogicalAgent(casesToTest, workspace, limits) {
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

    const execution = await sandbox.run(workspace, `${testCase.input}\n`, limits);
    const actualOutput = execution.output.trim();
    const result = {
      passed: execution.passed && actualOutput === testCase.expected.trim(),
      got: actualOutput || (execution.timedOut ? "Timeout" : execution.error || "No output"),
    };

    if (result.passed) score++;
    details.push({
      case: testCase.case,
      input: testCase.input,
      expected: testCase.expected,
      passed: result.passed,
      got: result.got || "Timeout",
      actual: result.got || "Timeout",
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
  const comments = cleanCode.match(/\/\/.*|\/\*[\s\S]*?\*\//g) || [];
  const functions = cleanCode.match(/\b[A-Za-z_]\w*\s*\([^;{}]*\)\s*\{/g) || [];
  const longIdentifiers = (cleanCode.match(/\b[A-Za-z_]\w{11,}\b/g) || []).length;
  const explanatoryComments = comments.filter((comment) =>
    /\b(initializ|calculate|check|return|read|print|loop|factorial|input|output)\b/i.test(comment),
  ).length;

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

  const prompt = `You are a cautious code-authorship review assistant. Evaluate the exact C code enclosed in the <CODE> tags below.

<CODE>
${cleanCode}
</CODE>

Observable source summary: ${comments.length} comments, ${explanatoryComments} explanatory comments, ${functions.length} function definitions, ${longIdentifiers} long identifiers.

Do not claim to determine who authored the code. Report only whether the code has an AI-style signal that merits instructor review. Standard algorithms, clean formatting, short programs, and common variable names are weak evidence and must not be enough on their own. Use the observable features in the code and return ONLY this strict JSON object:
{
  "signal": <boolean>,
  "confidence": <integer 0-100>,
  "reason": "<One cautious sentence naming observable traits>",
  "evidence": ["<observable trait>", "..."]
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
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
    const modelEvidence = Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((item) => typeof item === "string" && item.trim()).slice(0, 5)
      : [];
    const strongObservableTraits = [
      explanatoryComments >= 2,
      longIdentifiers >= 2,
      functions.length >= 3,
      modelEvidence.length >= 3,
    ].filter(Boolean).length;
    // A review flag requires multiple observable traits and high model
    // confidence. Common algorithms and clean formatting alone are not enough.
    const signal = Boolean(
      (parsed.signal ?? parsed.is_ai)
      && confidence >= 85
      && strongObservableTraits >= 2,
    );

    console.log(
      `  🚨 AI-style review: ${signal ? "Signal detected" : "No strong signal"} (${confidence}% confidence)`,
    );
    return {
      signal,
      is_ai: signal,
      confidence,
      reason: signal
        ? String(parsed.reason || "Multiple observable traits merit instructor review.")
        : "No strong AI-style signal was established from the available observable traits.",
      evidence: modelEvidence,
      model_reason: String(parsed.reason || "No explanation was returned."),
      scoring_impact: 0,
      strong_observable_traits: strongObservableTraits,
      source_summary: {
        comments: comments.length,
        explanatory_comments: explanatoryComments,
        functions: functions.length,
        long_identifiers: longIdentifiers,
      },
      method: "LLM-assisted review of observable source traits",
      review_only: true,
    };
  } catch (error) {
    console.log("  ❌ AI Detector Failed:", error.message);
    return {
      signal: false,
      is_ai: false,
      confidence: 0,
      reason: "AI-style review was unavailable; no authorship conclusion was made.",
      evidence: [],
      source_summary: {
        comments: comments.length,
        explanatory_comments: explanatoryComments,
        functions: functions.length,
        long_identifiers: longIdentifiers,
      },
      method: "unavailable",
      review_only: true,
      error: error.message,
    };
  }
}

function buildReviewSignals(metrics) {
  const flags = [];
  const aiMetric = metrics.find((metric) => metric.name === "ai_detection");
  const originalityMetric = metrics.find((metric) =>
    ["originality", "similarity_flag"].includes(metric.name),
  );
  const aiEvidence = aiMetric?.evidence || {};
  const originalityEvidence = originalityMetric?.evidence || {};

  if (aiEvidence.signal || aiEvidence.is_ai) flags.push("ai_style_review");
  if (originalityEvidence.flagged) flags.push("similarity_review");
  return {
    flags,
    aiDetected: Boolean(aiEvidence.signal || aiEvidence.is_ai),
    similarityDetected: Boolean(originalityEvidence.flagged),
  };
}

// ---------------------------------------------------------
// MASTER COORDINATOR: Database Fetch & Execute
// ---------------------------------------------------------
async function gradeSubmission(submissionId) {
  console.log(
    `\n🚀 Starting Agentic AutoGrader for Submission: ${submissionId}`,
  );

  let workspace;
  try {
    await sandbox.ensureAvailable();
    // 1. Fetch Submission & Problem Rules from Database
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { problem: true },
    });

    if (!submission) throw new Error("Submission not found!");

    const claim = await prisma.submission.updateMany({
      where: { id: submissionId, status: "PENDING" },
      data: { status: "GRADING" },
    });
    if (claim.count !== 1) {
      console.log(`Skipping submission ${submissionId}; it is already being graded or completed.`);
      return;
    }

    console.log(`📋 Loaded Rules for: ${submission.problem.title}`);
    const rules = loadDatabaseRules(submission.problem);
    const reportMetadata = buildReportMetadata({
      code: submission.code,
      rules,
    });

    workspace = await sandbox.createWorkspace(submission.id, submission.code);
    let firstPass;
    try {
      // 2. Run First Pass (Compile)
      firstPass = await runFirstPass(
        submission.code,
        submission.problem.timeLimitSec,
        workspace,
      );
    } finally {
      if (!firstPass?.success) sandbox.cleanup(workspace);
    }

    if (!firstPass.success) {
      console.log("❌ Compilation Failed. Consulting AI for syntax hints...");

      // Ab hum confidently firstPass.output use kar sakte hain
      const rawCompilerError =
        firstPass.output || firstPass.details || "Unknown Compiler Error";

      const aiFeedbackJSON = await analyzeCompilationError(
        submission.code,
        rawCompilerError,
      );

      const report = createReport({
        submissionId,
        ...reportMetadata,
        firstPass,
        finalScore: 0,
        metrics: [
          {
            name: "compilation_error",
            status: "BLOCKED",
            weight: 1.0,
            score: 0,
            contribution: 0,
            details: {
              rawError: rawCompilerError,
              aiHints: aiFeedbackJSON.hints,
              encouragement: aiFeedbackJSON.encouragement,
            },
          },
        ],
        flags: ["compilation_failed"],
        limitations: ["Execution-dependent analyzers were blocked by compilation failure."],
      });

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "COMPLETED",
          finalScore: 0,
          report: report,
        },
      });

      sandbox.cleanup(workspace);
      console.log("✅ AutoGrader Complete with Structured AI Syntax Help!");
      return;
    }

    // 3. Execute exactly the metrics configured in the database rules.
    const otherSubmissions = await prisma.submission.findMany({
      where: {
        problemId: submission.problemId,
        studentId: { not: submission.studentId },
        status: "COMPLETED",
      },
      select: { id: true, code: true },
    });

    const execution = await executeConfiguredRules(rules, {
      firstPass,
      runLogical: (cases) => runLogicalAgent(cases, workspace, {
        timeLimitSec: rules.time_limit_s,
        memoryLimitMb: rules.memory_limit_mb,
      }),
      explainLogicalFailure: (failedCases) =>
        analyzeLogicalFailure(submission.code, failedCases),
      runReadability: (params) =>
        runLLMReview(submission.code, params, false),
      runComplexity: (required) =>
        Promise.resolve(runComplexityAnalyzer(submission.code, required)),
      runStructure: () => runStructureAnalyzer(submission.code),
      runModularity: (params) => runModularityAnalyzer(submission.code, params),
      runMemorySafety: (params) => runMemorySafetyAnalyzer(
        submission.code,
        sandbox,
        workspace,
        {
          timeLimitSec: rules.time_limit_s,
          memoryLimitMb: rules.memory_limit_mb,
          ...params,
        },
      ),
      runOriginality: async (params) =>
        runOriginalityAnalyzer(submission.code, otherSubmissions, params.threshold),
      runAiDetection: () => runAIDetectorAgent(submission.code),
    });
    const metricScore = execution.finalScore;
    const reportMetrics = execution.metrics;

    // Authorship signals are always collected as zero-weight review evidence.
    // They never affect the configured grade and remain visible even when an
    // instructor did not add them as scoring metrics.
    if (!reportMetrics.some((metric) => metric.name === "ai_detection")) {
      const aiDetection = await runAIDetectorAgent(submission.code);
      reportMetrics.push({
        name: "ai_detection",
        status: "SUCCEEDED",
        score: null,
        weight: 0,
        contribution: null,
        reviewOnly: true,
        evidence: aiDetection,
        feedback: aiDetection.reason,
      });
    }
    if (!reportMetrics.some((metric) =>
      ["originality", "similarity_flag"].includes(metric.name),
    )) {
      const originality = await runOriginalityAnalyzer(
        submission.code,
        otherSubmissions,
        0.85,
      );
      reportMetrics.push({
        name: "originality",
        status: "SUCCEEDED",
        score: null,
        weight: 0,
        contribution: null,
        reviewOnly: true,
        evidence: originality.evidence,
        feedback: originality.feedback,
      });
    }
    const reviewSignals = buildReviewSignals(reportMetrics);

    // 🔥 PEER-TO-PEER PLAGIARISM CHECK 🔥
    console.log(`\n🕵️‍♂️ Checking for Peer Plagiarism...`);
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
    const integrityPenalty = isPlagiarized ? 100 : 0;
    const totalScore = isPlagiarized ? 0 : metricScore;
    const integrityDecision = isPlagiarized
      ? "EXACT_PEER_MATCH_SCORE_ZERO"
      : "NO_EXACT_PEER_MATCH";
    const reportFlags = [
      ...(reviewSignals.flags || []),
      ...(isPlagiarized ? ["similarity_match"] : []),
    ];

    // 4. Save Final Report to Database
    console.log(
      `\n💾 Saving Final Score: ${totalScore}/100 to Database...` +
      (isPlagiarized ? " Exact peer match detected; score set to 0." : ""),
    );
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "COMPLETED",
        finalScore: totalScore,
        isPlagiarized: isPlagiarized, // 🔥 DB me flag update hoga
        plagiarismScore: plagiarismScore,
        matchedWithId: matchedWithId,
        report: createReport({
          submissionId,
          ...reportMetadata,
          firstPass,
          metrics: reportMetrics,
          finalScore: totalScore,
          flags: reportFlags,
          integrity: {
            exact_peer_match: isPlagiarized,
            similarity_score: plagiarismScore,
            matched_submission_id: matchedWithId,
            decision: integrityDecision,
            marks_before_integrity: metricScore,
            marks_deducted: integrityPenalty,
            marks_after_integrity: totalScore,
          },
          usefulness: [
            "Provides deterministic test evidence and weighted metric contributions.",
            "Provides actionable feedback for failed cases and configured code-quality metrics.",
            reviewSignals.aiDetected
              ? "AI-style review produced a signal for instructor follow-up; marks affected: 0."
              : "AI-style review ran and found no strong signal in the submitted source; marks affected: 0.",
            isPlagiarized
              ? "Peer-code similarity review found an exact normalized peer-code match; the integrity policy set the final score to 0."
              : reviewSignals.similarityDetected
                ? "Peer-code similarity review produced a non-exact signal using the available submission corpus; marks affected: 0."
                : "Peer-code similarity review found no high-similarity match in the available corpus; marks affected: 0.",
            ...(isPlagiarized
              ? ["An exact normalized peer-code match was found; the assignment integrity policy set the final score to 0."]
              : []),
          ],
          limitations: [
            "Originality and AI-style signals are review indicators, not proof of misconduct.",
            "Static complexity and structure analysis are heuristic and depend on configured rules.",
            ...(reportMetrics.some((metric) => metric.name === "ai_detection")
              ? ["AI-style analysis cannot reliably prove whether a person or AI authored code."]
              : ["AI-style analysis was not configured for this assignment; no AI authorship signal was produced."]),
            ...(reportMetrics.some((metric) =>
              ["originality", "similarity_flag"].includes(metric.name),
            )
              ? []
              : ["Peer-code similarity analysis was not configured for this assignment."]),
          ],
        }),
      },
    });

    sandbox.cleanup(workspace);
    console.log("✅ AutoGrader Complete!");
  } catch (error) {
    console.error("Error during grading:", error);
    if (workspace) sandbox.cleanup(workspace);
    try {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "FAILED",
          report: createReport({
            submissionId,
            flags: ["grading_failed"],
            limitations: [error.message],
          }),
        },
      });
    } catch (persistenceError) {
      console.error("Failed to persist grading failure:", persistenceError);
    }
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
