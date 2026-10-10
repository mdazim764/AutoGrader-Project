const { exec } = require("child_process");
const path = require("path");

// Windows ke paths ko properly handle karne ke liye
const submissionPath = path.join(__dirname, "../submissions/test.c");
const outputPath = path.join(__dirname, "../submissions/test.exe"); // Windows mein .exe banti hai

console.log("Compiling C Code...");

// Executing GCC command
exec(`gcc "${submissionPath}" -o "${outputPath}"`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Compilation Failed!\nError: ${error.message}`);
    return;
  }
  if (stderr) {
    console.warn(`Compiler Warnings:\n${stderr}`);
  }
  console.log("Compilation Successful! Binary created at:", outputPath);
});
