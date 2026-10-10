const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors()); // React ko connect karne deta hai
app.use(express.json()); // JSON data receive karne ke liye

// Paths
const codePath = path.join(__dirname, "../submissions/test.c");
const reportJsonPath = path.join(__dirname, "../reports/report.json");
const coordinatorPath = path.join(__dirname, "coordinator.js");

// 🚀 API Endpoint: Receive code from React and return Grade
app.post("/api/grade", (req, res) => {
  const studentCode = req.body.code;

  if (!studentCode) {
    return res.status(400).json({ error: "No code provided!" });
  }

  console.log("\n📥 Received new submission from Frontend!");

  // 1. React se aaya hua code 'test.c' mein save karna
  fs.writeFileSync(codePath, studentCode);
  console.log("📝 Saved to test.c. Starting Coordinator...");

  // 2. Apne Coordinator engine ko trigger karna
  exec(`node "${coordinatorPath}"`, (error, stdout, stderr) => {
    // Log coordinator output to terminal for debugging
    console.log(stdout);

    if (error) {
      console.error("Coordinator Error:", error.message);
      return res.status(500).json({ error: "Grader engine failed to run." });
    }

    // 3. Coordinator ne jo report.json banayi hai, use read karke React ko wapas bhejna
    try {
      const reportData = fs.readFileSync(reportJsonPath, "utf-8");
      const result = JSON.parse(reportData);
      console.log("📤 Sending report back to Frontend!");
      res.json(result); // Sends the final JSON back to the UI
    } catch (readError) {
      console.error("Failed to read report.json:", readError);
      res.status(500).json({ error: "Failed to generate report." });
    }
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ AutoGrader API is running on http://localhost:${PORT}`);
});
