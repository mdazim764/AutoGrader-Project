const { collateResults } = require("./score-collator");

function metricResult(score, evidence = {}, feedback = null) {
  return { status: "SUCCEEDED", score, evidence, feedback };
}

async function executeConfiguredRules(rules, context) {
  const results = [];

  for (const metric of rules.metrics) {
    const { analyzer, params } = metric;
    let result;

    if (analyzer === "logical" || analyzer === "edge_case_runner") {
      const logical = await context.runLogical(params.cases);
      let feedback = null;
      if (logical.score < 1 && context.explainLogicalFailure) {
        feedback = await context.explainLogicalFailure(
          logical.details.filter((detail) => !detail.passed),
        );
      }
      result = {
        ...metricResult(logical.score, { details: logical.details }, feedback),
        details: logical.details,
        aiFeedback: feedback,
      };
    } else if (analyzer === "io_tests") {
      if (!Array.isArray(params.cases) || params.cases.length === 0) {
        result = {
          status: "BLOCKED",
          score: null,
          evidence: {},
          errors: ["io_tests requires params.cases in database rules."],
        };
      } else {
        const correctness = await context.runLogical(params.cases);
        result = {
          ...metricResult(correctness.score, { details: correctness.details }),
          details: correctness.details,
        };
      }
    } else if (analyzer === "compiler_warnings") {
      const firstPass = context.firstPass || {};
      if (!firstPass.success) {
        result = {
          status: "BLOCKED",
          score: null,
          evidence: { output: firstPass.output || null },
          errors: ["Compiler warnings cannot be scored after compilation failure."],
        };
      } else {
        const warnings = String(firstPass.warnings || "").trim();
        result = metricResult(warnings ? 0 : 1, {
          warnings: warnings || null,
          flags: params.flags || null,
        });
      }
    } else if (analyzer === "static_analysis" || analyzer === "structure") {
      const analysis = context.runStructure();
      result = metricResult(analysis.score, analysis.evidence, analysis.feedback);
    } else if (analyzer === "function_split" || analyzer === "modularity") {
      const analysis = context.runModularity(params);
      result = metricResult(analysis.score, analysis.evidence, analysis.feedback);
    } else if (analyzer === "sanitizer_run" || analyzer === "memory_safety") {
      const analysis = await context.runMemorySafety(params);
      result = metricResult(analysis.score, analysis.evidence, analysis.feedback);
    } else if (analyzer === "similarity_flag" || analyzer === "originality") {
      const analysis = await context.runOriginality(params);
      result = {
        ...metricResult(analysis.score, analysis.evidence, analysis.feedback),
        reviewOnly: true,
      };
    } else if (analyzer === "readability" || analyzer === "llm_review") {
      const review = await context.runReadability(params);
      result = metricResult(review.score, {}, review.feedback);
    } else if (analyzer === "complexity" || analyzer === "complexity_estimator") {
      const complexity = await context.runComplexity(params.required);
      result = {
        ...metricResult(complexity.score, {
        estimated: complexity.estimated,
        runs: complexity.details,
        }, complexity.feedback),
        details: {
          estimated: complexity.estimated,
          feedback: complexity.feedback,
          runs: complexity.details,
        },
      };
    } else if (analyzer === "ai_detection") {
      const detection = await context.runAiDetection();
      result = {
        ...metricResult(1, detection, detection.reason),
        reviewOnly: true,
      };
    } else {
      result = {
        status: "SKIPPED",
        score: null,
        evidence: {},
        errors: [`Analyzer "${analyzer}" is not implemented in the active worker.`],
      };
    }

    results.push({ metric, result });
  }

  return collateResults(results);
}

module.exports = { executeConfiguredRules };
