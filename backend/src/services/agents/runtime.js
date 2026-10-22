const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");

const submissionsDir = path.join(__dirname, "../../submissions");
const exePath = path.join(submissionsDir, "test.exe");

if (!fs.existsSync(submissionsDir)) {
  fs.mkdirSync(submissionsDir, { recursive: true });
}

module.exports = { fs, path, exec, spawn, submissionsDir, exePath };
