const { fs, path, exec, submissionsDir, exePath } = require("./runtime");
// AGENT 1: The First Pass (Compiler & Setup with Fallback)
// ---------------------------------------------------------
async function runFirstPass(code, timeLimitSec) {
  const codePath = path.join(submissionsDir, "test.c");
  const errorPath = path.join(submissionsDir, "error.log");
  fs.writeFileSync(codePath, code);

  return new Promise((resolve) => {
    // Attempt 1: Try compiling with AddressSanitizer (Memory Leak Detection)
    exec(
      `gcc -O2 -Wall -Wextra -std=c11 -fsanitize=address -g "${codePath}" -o "${exePath}" 2> "${errorPath}"`,
      (error, stdout, stderr) => {
        if (error) {
          const gccError = fs.readFileSync(errorPath, "utf-8");

          // Check if it failed specifically because MinGW is missing the ASAN library
          if (gccError.includes("lasan") || gccError.includes("sanitize")) {
            console.log(
              "⚠️ MinGW ASAN not found. Falling back to standard compilation...",
            );

            // Attempt 2: Fallback to standard compilation without ASAN
            exec(
              `gcc -O2 -Wall -Wextra -std=c11 -g "${codePath}" -o "${exePath}" 2> "${errorPath}"`,
              (fallbackError, fallbackStdout, fallbackStderr) => {
                if (fallbackError) {
                  const fallbackGccError = fs.readFileSync(errorPath, "utf-8");
                  console.log(
                    `\n❌ GCC Compilation Error:\n${fallbackGccError}`,
                  );
                  resolve({
                    success: false,
                    reason: "Compilation Failed",
                    output: fallbackGccError,
                  });
                } else {
                  resolve({ success: true, warnings: fallbackStderr });
                }
              },
            );
          } else {
            // It's a genuine syntax error made by the student
            console.log(`\n❌ GCC Compilation Error:\n${gccError}`);
            resolve({
              success: false,
              reason: "Compilation Failed",
              output: gccError,
            });
          }
        } else {
          resolve({ success: true, warnings: stderr });
        }
      },
    );
  });
}

// ---------------------------------------------------------

module.exports = { runFirstPass };

