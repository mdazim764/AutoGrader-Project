
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

module.exports = { analyzeLogicalFailure };

