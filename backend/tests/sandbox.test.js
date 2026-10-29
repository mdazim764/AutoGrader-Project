const test = require("node:test");
const assert = require("node:assert/strict");
const sandbox = require("../src/sandbox/wsl-executor");

let available = false;

test.before(async () => {
  try {
    await sandbox.ensureAvailable();
    available = true;
  } catch {
    available = false;
  }
});

async function withProgram(id, code, callback) {
  const workspace = await sandbox.createWorkspace(id, code);
  try {
    const compilation = await sandbox.compile(workspace, 2);
    return await callback(workspace, compilation);
  } finally {
    sandbox.cleanup(workspace);
  }
}

test("WSL sandbox compiles and runs a correct program", async (t) => {
  if (!available) return t.skip("WSL2 prerequisites are unavailable");
  await withProgram(
    "sandbox-correct",
    "#include <stdio.h>\nint main(void){int n; scanf(\"%d\", &n); printf(\"%d\\n\", n * 2); return 0;}",
    async (workspace, compilation) => {
      assert.equal(compilation.success, true);
      const result = await sandbox.run(workspace, "21\n", { timeLimitSec: 2, memoryLimitMb: 64 });
      assert.equal(result.passed, true);
      assert.equal(result.output.trim(), "42");
    },
  );
});

test("WSL sandbox reports compilation failure", async (t) => {
  if (!available) return t.skip("WSL2 prerequisites are unavailable");
  await withProgram(
    "sandbox-compile-failure",
    "int main(void) { return ;",
    async (_workspace, compilation) => {
      assert.equal(compilation.success, false);
      assert.equal(compilation.reason, "Compilation failed");
      assert.match(compilation.output, /error/i);
    },
  );
});

test("WSL sandbox reports an infinite loop timeout", async (t) => {
  if (!available) return t.skip("WSL2 prerequisites are unavailable");
  await withProgram(
    "sandbox-timeout",
    "int main(void){for(;;){} return 0;}",
    async (workspace, compilation) => {
      assert.equal(compilation.success, true);
      const result = await sandbox.run(workspace, "", { timeLimitSec: 1, memoryLimitMb: 64 });
      assert.equal(result.timedOut, true);
      assert.equal(result.passed, false);
    },
  );
});

test("WSL sandbox reports runtime crashes", async (t) => {
  if (!available) return t.skip("WSL2 prerequisites are unavailable");
  await withProgram(
    "sandbox-crash",
    "#include <stdlib.h>\nint main(void){ int *value = NULL; *value = 1; return 0; }",
    async (workspace, compilation) => {
      assert.equal(compilation.success, true);
      const result = await sandbox.run(workspace, "", { timeLimitSec: 2, memoryLimitMb: 64 });
      assert.equal(result.passed, false);
      assert.equal(result.crashed, true);
    },
  );
});

test("WSL sandbox enforces the memory limit", async (t) => {
  if (!available) return t.skip("WSL2 prerequisites are unavailable");
  await withProgram(
    "sandbox-memory",
    "#include <stdio.h>\n#include <stdlib.h>\nint main(void){ size_t n = 64 * 1024 * 1024; volatile char *p = malloc(n); if (!p) return 2; for (size_t i = 0; i < n; i += 4096) p[i] = 1; printf(\"%d\\n\", p[n - 4096]); return 0; }",
    async (workspace, compilation) => {
      assert.equal(compilation.success, true);
      const result = await sandbox.run(workspace, "", { timeLimitSec: 2, memoryLimitMb: 16 });
      assert.equal(result.passed, false);
      assert.equal(result.crashed || result.timedOut, true);
    },
  );
});

test("WSL sandbox rejects invalid workspace identifiers", async () => {
  await assert.rejects(
    () => sandbox.createWorkspace("../unsafe", "int main(void){return 0;}"),
    /Invalid submission identifier/,
  );
});
