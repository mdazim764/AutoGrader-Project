
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

module.exports = { runLLMReview };

