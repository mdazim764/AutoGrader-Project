function sourceMetrics(code) {
  const source = String(code || "");
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const functions = [...withoutComments.matchAll(
    /\b(?:static\s+)?(?:unsigned\s+|signed\s+)?(?:long\s+long|long|short|int|char|float|double|void)\s+\w+\s*\([^;{}]*\)\s*\{/g,
  )].map((match) => match[0]);
  const loops = [...withoutComments.matchAll(/\b(for|while|do)\b/g)].length;
  const braces = [...withoutComments].filter((char) => char === "{").length;
  const nestedLoopDepth = Math.max(
    0,
    (withoutComments.match(/\b(for|while)\b[\s\S]*\b(for|while)\b/g) || []).length,
  );
  const hasMain = /\bmain\s*\(/.test(withoutComments);
  const hasReturn = /\breturn\b/.test(withoutComments);
  const hasInput = /\b(scanf|fscanf|fgets|getchar|read)\s*\(/.test(withoutComments);
  const hasOutput = /\b(printf|fprintf|puts|putchar|write)\s*\(/.test(withoutComments);

  return {
    source,
    withoutComments,
    functions,
    functionCount: functions.length,
    loopCount: loops,
    nestedLoopDepth,
    hasMain,
    hasReturn,
    hasInput,
    hasOutput,
  };
}

function runStructureAnalyzer(code) {
  const metrics = sourceMetrics(code);
  const checks = [
    ["main function exists", metrics.hasMain],
    ["return statement exists", metrics.hasReturn],
    ["input operation detected", metrics.hasInput],
    ["output operation detected", metrics.hasOutput],
  ];
  const passed = checks.filter(([, value]) => value).length;
  return {
    score: passed / checks.length,
    evidence: { checks: checks.map(([name, value]) => ({ name, passed: value })) },
    feedback: `${passed} of ${checks.length} structural sanity checks passed.`,
  };
}

function runModularityAnalyzer(code, params = {}) {
  const metrics = sourceMetrics(code);
  const minimumFunctions = Number(params.minimum_functions || 1);
  const helperFunctions = Math.max(0, metrics.functionCount - 1);
  const checks = [
    ["main function exists", metrics.hasMain],
    [`at least ${minimumFunctions} function(s)`, metrics.functionCount >= minimumFunctions],
    ["helper function exists", helperFunctions > 0],
  ];
  const passed = checks.filter(([, value]) => value).length;
  return {
    score: passed / checks.length,
    evidence: {
      function_count: metrics.functionCount,
      helper_function_count: helperFunctions,
      checks: checks.map(([name, value]) => ({ name, passed: value })),
    },
    feedback: helperFunctions > 0
      ? "The solution separates work into helper functions."
      : "Most logic is concentrated in main; consider extracting a helper function.",
  };
}

function estimateComplexity(code) {
  const metrics = sourceMetrics(code);
  if (/\bmain\s*\([^)]*\)[\s\S]*\b\w+\s*\([^)]*\)/.test(metrics.withoutComments) && /\breturn\s+\w+\s*\(/.test(metrics.withoutComments)) {
    return "O(N)";
  }
  if (metrics.nestedLoopDepth > 0) return "O(N^2)";
  if (metrics.loopCount > 0) return "O(N)";
  return "O(1)";
}

function runComplexityAnalyzer(code, requiredComplexity) {
  const estimated = estimateComplexity(code);
  const required = String(requiredComplexity || "O(1)").replace(/\s/g, "").toUpperCase();
  const actual = estimated.replace(/\s/g, "").toUpperCase();
  const matches = actual === required;
  return {
    score: matches ? 1 : 0,
    estimated,
    evidence: {
      estimated,
      required: requiredComplexity || "O(1)",
      method: "deterministic source loop analysis",
    },
    feedback: matches
      ? `Estimated complexity ${estimated} matches the required bound.`
      : `Estimated complexity ${estimated} does not match the required bound ${requiredComplexity || "O(1)"}.`,
  };
}

module.exports = {
  sourceMetrics,
  runStructureAnalyzer,
  runModularityAnalyzer,
  runComplexityAnalyzer,
};
