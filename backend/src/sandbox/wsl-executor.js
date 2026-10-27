const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const workspaceRoot = path.join(os.tmpdir(), "agentic-autograder");

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function toWslPath(value) {
  const resolved = path.resolve(value);
  const match = resolved.match(/^([A-Za-z]):\\(.*)$/);
  if (!match) {
    throw new Error(`WSL executor requires a Windows drive path: ${resolved}`);
  }
  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, "/")}`;
}

function runWsl(script, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn("wsl.exe", ["-e", "bash", "-lc", script], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut });
    });
  });
}

async function ensureAvailable() {
  const result = await runWsl("command -v bash >/dev/null && command -v gcc >/dev/null && command -v timeout >/dev/null", 5000);
  if (result.timedOut || result.code !== 0) {
    throw new Error(
      "WSL2 with bash, gcc, and coreutils timeout is required for safe grading. Install WSL2, a Linux distribution, bash, gcc, and coreutils before grading submissions.",
    );
  }
}

async function createWorkspace(submissionId, code) {
  if (!/^[a-zA-Z0-9-]+$/.test(submissionId)) {
    throw new Error("Invalid submission identifier.");
  }
  const workspace = path.join(workspaceRoot, submissionId);
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, "submission.c"), code, "utf8");
  return workspace;
}

async function compile(workspace, timeLimitSec) {
  const wslWorkspace = toWslPath(workspace);
  const compileTimeout = Math.max(1000, timeLimitSec * 1000);
  const script = [
    `cd ${shellQuote(wslWorkspace)}`,
    "ulimit -f 1024",
    `timeout --signal=KILL ${Math.max(1, timeLimitSec)}s gcc -O2 -Wall -Wextra -std=c11 submission.c -o submission 2>compile.stderr`,
  ].join(" && ");
  const result = await runWsl(script, compileTimeout + 1000);
  const stderrPath = path.join(workspace, "compile.stderr");
  const stderr = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, "utf8") : result.stderr;
  return {
    success: !result.timedOut && result.code === 0,
    warnings: stderr,
    output: stderr,
    reason: result.timedOut ? "Compilation timeout" : "Compilation failed",
    executablePath: path.join(workspace, "submission"),
  };
}

async function run(workspace, input, limits) {
  const wslWorkspace = toWslPath(workspace);
  const inputPath = path.join(workspace, "input.txt");
  fs.writeFileSync(inputPath, input, "utf8");
  const timeoutSec = Math.max(1, Number(limits.timeLimitSec) || 1);
  const memoryKb = Math.max(16384, (Number(limits.memoryLimitMb) || 64) * 1024);
  const script = [
    `cd ${shellQuote(wslWorkspace)}`,
    `ulimit -v ${memoryKb}`,
    "ulimit -f 1024",
    `timeout --signal=KILL ${timeoutSec}s bash -c 'ulimit -u 32; exec ./submission' < input.txt > output.txt 2> runtime.stderr`,
  ].join(" && ");
  const result = await runWsl(script, timeoutSec * 1000 + 1000);
  const outputPath = path.join(workspace, "output.txt");
  const errorPath = path.join(workspace, "runtime.stderr");
  return {
    passed: !result.timedOut && result.code === 0,
    timedOut: result.timedOut || result.code === 124 || result.code === 137,
    crashed: !result.timedOut && result.code !== 0 && result.code !== 124 && result.code !== 137,
    output: fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "",
    error: fs.existsSync(errorPath) ? fs.readFileSync(errorPath, "utf8") : result.stderr,
    exitCode: result.code,
  };
}

async function runSanitized(workspace, input, limits) {
  const wslWorkspace = toWslPath(workspace);
  const inputPath = path.join(workspace, "sanitizer-input.txt");
  fs.writeFileSync(inputPath, input, "utf8");
  const timeoutSec = Math.max(1, Number(limits.timeLimitSec) || 1);
  const memoryKb = Math.max(16384, (Number(limits.memoryLimitMb) || 64) * 1024);
  const script = [
    `cd ${shellQuote(wslWorkspace)}`,
    `ulimit -v ${memoryKb}`,
    "ulimit -f 1024",
    "gcc -O1 -g -fsanitize=address,undefined -fno-omit-frame-pointer submission.c -o sanitized 2> sanitizer-compile.stderr",
    `timeout --signal=KILL ${timeoutSec}s bash -c 'ulimit -u 32; exec ./sanitized' < sanitizer-input.txt > sanitizer-output.txt 2> sanitizer.stderr`,
  ].join(" && ");
  const result = await runWsl(script, timeoutSec * 1000 + 3000);
  const read = (file) => fs.existsSync(path.join(workspace, file))
    ? fs.readFileSync(path.join(workspace, file), "utf8")
    : "";
  const compileError = read("sanitizer-compile.stderr");
  const runtimeError = read("sanitizer.stderr");
  return {
    passed: !result.timedOut && result.code === 0,
    timedOut: result.timedOut || result.code === 124 || result.code === 137,
    crashed: !result.timedOut && result.code !== 0 && result.code !== 124 && result.code !== 137,
    output: read("sanitizer-output.txt"),
    error: compileError || runtimeError || result.stderr,
    exitCode: result.code,
  };
}

function cleanup(workspace) {
  fs.rmSync(workspace, { recursive: true, force: true });
}

module.exports = {
  ensureAvailable,
  createWorkspace,
  compile,
  run,
  runSanitized,
  cleanup,
};
