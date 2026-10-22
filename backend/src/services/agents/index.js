const compiler = require("./compiler.agent");
const logical = require("./logical.agent");
const logicalFeedback = require("./logical-feedback.agent");
const readability = require("./readability.agent");
const complexity = require("./complexity.agent");
const compilerFeedback = require("./compiler-feedback.agent");
const aiDetector = require("./ai-detector.agent");

module.exports = {
  compiler,
  logical,
  logicalFeedback,
  readability,
  complexity,
  compilerFeedback,
  aiDetector,
};
