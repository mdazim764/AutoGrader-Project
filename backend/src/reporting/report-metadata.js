const crypto = require("crypto");
const { execFileSync } = require("child_process");

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value)).digest("hex")}`;
}

function getToolVersions() {
  let gcc = "unavailable";
  try {
    gcc = execFileSync("wsl.exe", ["-e", "gcc", "--version"], {
      encoding: "utf8",
      timeout: 5000,
    }).split(/\r?\n/)[0];
  } catch {
    gcc = "WSL GCC unavailable";
  }

  return {
    node: process.version,
    platform: process.platform,
    sandbox: "WSL2 + Bash + coreutils timeout",
    gcc,
  };
}

function buildReportMetadata({ code, rules }) {
  const canonicalRules = stableStringify(rules);
  const testSet = rules.metrics.map((metric) => ({
    name: metric.name,
    params: metric.params,
  }));
  return {
    submissionHash: sha256(code),
    rulesHash: sha256(canonicalRules),
    testSetHash: sha256(stableStringify(testSet)),
    toolVersions: getToolVersions(),
  };
}

module.exports = {
  buildReportMetadata,
  sha256,
  stableStringify,
};
