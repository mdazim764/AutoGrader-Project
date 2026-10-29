const DEFAULT_ENDPOINT =
  process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const DEFAULT_RETRIES = Number(process.env.OLLAMA_RETRIES || 2);

class OllamaUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "OllamaUnavailableError";
    this.cause = cause;
  }
}

async function generateJson(prompt, options = {}) {
  const endpoint = options.endpoint || DEFAULT_ENDPOINT;
  const model = options.model || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (retries > 0) {
      console.log(
        `  🤖 Ollama request attempt ${attempt + 1}/${retries + 1} (timeout ${timeoutMs}ms)`,
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: "json",
          options: { temperature: 0, ...(options.generationOptions || {}) },
        }),
      });
      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!data?.response) throw new Error("Ollama returned no response");
      return JSON.parse(data.response);
    } catch (error) {
      lastError =
        error.name === "AbortError"
          ? new Error(`Ollama timed out after ${timeoutMs}ms`)
          : error;
      if (attempt < retries) continue;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new OllamaUnavailableError(
    lastError?.message || "Ollama is unavailable",
    lastError,
  );
}

function getConfiguration() {
  return {
    endpoint: DEFAULT_ENDPOINT,
    model: DEFAULT_MODEL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
  };
}

module.exports = {
  DEFAULT_ENDPOINT,
  DEFAULT_MODEL,
  OllamaUnavailableError,
  getConfiguration,
  generateJson,
};
