const rules = require("./rules.contract");
const analyzerResults = require("./analyzer-result.contract");
const reports = require("./report.contract");

module.exports = {
  ...rules,
  ...analyzerResults,
  ...reports,
};
