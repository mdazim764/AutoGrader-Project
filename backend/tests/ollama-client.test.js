const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { generateJson, OllamaUnavailableError } = require("../src/services/agents/ollama.client");

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        endpoint: `http://127.0.0.1:${server.address().port}`,
      });
    });
  });
}

test("Ollama client parses strict JSON responses", async () => {
  const { server, endpoint } = await startServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ response: JSON.stringify({ score: 8 }) }));
  });
  try {
    assert.deepEqual(await generateJson("test", { endpoint }), { score: 8 });
  } finally {
    server.close();
  }
});

test("Ollama client times out and exposes an unavailable error", async () => {
  const { server, endpoint } = await startServer(() => {});
  try {
    await assert.rejects(
      generateJson("test", { endpoint, timeoutMs: 20, retries: 0 }),
      (error) => error instanceof OllamaUnavailableError && /timed out/.test(error.message),
    );
  } finally {
    server.close();
  }
});

test("Ollama client retries each request independently without a shared cooldown", async () => {
  let requests = 0;
  const { server, endpoint } = await startServer((_req, res) => {
    requests += 1;
    if (requests === 1) {
      setTimeout(() => res.end(), 40);
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ response: JSON.stringify({ recovered: true }) }));
  });
  try {
    const result = await generateJson("test", {
      endpoint,
      timeoutMs: 20,
      retries: 1,
    });
    assert.deepEqual(result, { recovered: true });
    assert.equal(requests, 2);
  } finally {
    server.close();
  }
});
