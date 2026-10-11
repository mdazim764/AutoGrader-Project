async function runAPITests() {
  console.log("🧪 Starting API End-to-End Test...\n");

  // ---------------------------------------------------------
  // TEST 1: GET All Problems (Instructor / Student View)
  // ---------------------------------------------------------
  console.log("➡️ TEST 1: Fetching Problems (GET /api/problems)...");
  const problemsRes = await fetch("http://localhost:5000/api/problems");
  const problems = await problemsRes.json();

  if (problems.length === 0) {
    console.log("❌ No problems found in DB!");
    return;
  }
  const targetProblem = problems[0];
  console.log(
    `✅ Success! Found Problem: "${targetProblem.title}" (ID: ${targetProblem.id})\n`,
  );

  // ---------------------------------------------------------
  // TEST 2: Submit Code (Student Action)
  // ---------------------------------------------------------
  console.log("➡️ TEST 2: Submitting C Code (POST /api/submissions)...");
  const studentCode = `#include <stdio.h>\nint main() {\n  long long a, b;\n  scanf("%lld %lld", &a, &b);\n  printf("%lld\\n", a + b);\n  return 0;\n}`;

  const submitRes = await fetch("http://localhost:5000/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      problemId: targetProblem.id,
      code: studentCode,
    }),
  });
  const submitData = await submitRes.json();
  console.log(`✅ Success! Submission ID: ${submitData.submissionId}`);
  console.log(`ℹ️ API Response: ${submitData.message}\n`);

  // ---------------------------------------------------------
  // TEST 3 & 4: Polling for the Agent to Complete
  // ---------------------------------------------------------
  console.log("⏳ Waiting for Agentic Grader (AI takes a few seconds)...");

  let resultData;
  let attempts = 0;

  // Poll the API every 2 seconds until status changes from GRADING/PENDING
  while (attempts < 20) {
    const resultRes = await fetch(
      `http://localhost:5000/api/submissions/${submitData.submissionId}`,
    );
    resultData = await resultRes.json();

    if (resultData.status === "COMPLETED" || resultData.status === "FAILED") {
      break; // Exit loop when done
    }

    // Print progress without making new lines
    process.stdout.write(
      `⏱️ Agent is analyzing... (Attempt ${attempts + 1})\r`,
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;
  }

  console.log(`\n✅ Success! Result Fetched.`);
  console.log(`\n🏆 FINAL SCORE: ${resultData.finalScore} / 100`);
  console.log(`📊 STATUS: ${resultData.status}`);

  if (resultData.report && resultData.report.metrics) {
    console.log(
      "📝 AGENT REPORT PREVIEW:",
      JSON.stringify(resultData.report.metrics, null, 2),
    );
  } else {
    console.log("⚠️ No report metrics found. Check Agent console.");
  }
}

runAPITests().catch(console.error);
