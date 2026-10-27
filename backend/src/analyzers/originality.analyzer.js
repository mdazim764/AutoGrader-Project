function tokenize(code) {
  return new Set(String(code || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .match(/[A-Za-z_]\w*|\d+|[{}()[\];,+\-*/%<>=]/g) || []);
}

function similarity(left, right) {
  const a = tokenize(left);
  const b = tokenize(right);
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function runOriginalityAnalyzer(code, submissions, threshold = 0.85) {
  let best = { score: 0, matchedSubmission: null };
  for (const submission of submissions || []) {
    const score = similarity(code, submission.code);
    if (score > best.score) {
      best = { score, matchedSubmission: submission.id };
    }
  }
  const flagged = best.score >= Number(threshold);
  return {
    score: 1,
    evidence: {
      flagged,
      similarity: Number(best.score.toFixed(4)),
      threshold: Number(threshold),
      matched_submission: best.matchedSubmission,
      review_only: true,
    },
    feedback: flagged
      ? "High similarity detected. Instructor review recommended; this signal is not proof of misconduct."
      : "No high-similarity match was detected in the available submission corpus.",
  };
}

module.exports = { runOriginalityAnalyzer };
