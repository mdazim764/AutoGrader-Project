const fs = require("fs");
const path = require("path");

// Target file jo analyze karni hai
const submissionPath = path.join(__dirname, "../submissions/test.c");

async function analyzeReadability() {
  console.log("Analyzing Code Readability with Ollama...\n");

  // Student ka code read karna
  const code = fs.readFileSync(submissionPath, "utf-8");

  // Prompt Engineering: LLM ko strict instructions dena
  const prompt = `
    You are an expert C programming instructor evaluating a student's code.
    Review the following C code for readability, variable naming, modularity, and structure.
    Do NOT evaluate correctness or logical output.
    
    Return ONLY a JSON object in the following exact format, with no extra text:
    {
        "score": <a numeric score between 0 and 10>,
        "feedback": "<One short sentence highlighting what is good or what needs improvement>"
    }

    Here is the C code:
    \n${code}
    `;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt: prompt,
        stream: false,
        format: "json", // This forces Ollama to return strictly structured JSON
      }),
    });

    if (!response.ok) {
      console.error(`Ollama Error: ${response.statusText}`);
      return;
    }

    const data = await response.json();

    // Parse the JSON string returned by Ollama into a JavaScript object
    const result = JSON.parse(data.response);

    console.log("✅ LLM Review Completed:");
    console.log(`Metric: Readability`);
    console.log(`Score:  ${result.score} / 10`);
    console.log(`Review: ${result.feedback}\n`);

    return result;
  } catch (error) {
    console.error("LLM Analysis Failed:", error.message);
  }
}

analyzeReadability();
