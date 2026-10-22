
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

module.exports = { analyzeCompilationError };

