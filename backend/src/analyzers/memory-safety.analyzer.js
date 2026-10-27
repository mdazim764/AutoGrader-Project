async function runMemorySafetyAnalyzer(code, sandbox, workspace, limits) {
  const result = await sandbox.runSanitized(workspace, "", limits);
  const clean = !result.error && !result.crashed && !result.timedOut;
  return {
    score: clean ? 1 : 0,
    evidence: {
      sanitizer: "address,undefined",
      output: result.output,
      error: result.error,
      timed_out: result.timedOut,
      crashed: result.crashed,
    },
    feedback: clean
      ? "No AddressSanitizer or UndefinedBehaviorSanitizer failure was observed in the smoke run."
      : "Sanitizer execution reported a runtime or memory-safety failure.",
  };
}

module.exports = { runMemorySafetyAnalyzer };
