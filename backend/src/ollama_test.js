// backend/src/ollama_test.js

async function checkOllama() {
  console.log("Checking Ollama Connection...\n");
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.1:8b", // EXACT name jo tune pull kiya hai
        prompt:
          "In one short sentence, why should a C program not return a pointer to a local variable?",
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Ollama Error: ${response.status} ${response.statusText}`);
      console.error(`Details: ${errText}`);
      return;
    }

    const data = await response.json();
    console.log("✅ Ollama Response Successfully Received:\n");
    console.log(data.response.trim());
  } catch (error) {
    console.error("Failed to connect to Ollama. Is the server running?");
    console.error(error.message);
  }
}

checkOllama();
