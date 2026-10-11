require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { gradeSubmission } = require("./agent_coordinator"); // Importing our Agent

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Prisma Initialization (v7 standard)
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ==========================================
// 1. INSTRUCTOR & STUDENT: Get All Problems
// ==========================================
app.get("/api/problems", async (req, res) => {
  try {
    const problems = await prisma.problem.findMany({
      select: {
        id: true,
        title: true,
        statement: true,
        timeLimitSec: true,
        memoryLimitMb: true,
      },
    });
    res.json(problems);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch problems." });
  }
});

// ==========================================
// 2. INSTRUCTOR: Create a New Problem
// ==========================================
app.post("/api/problems", async (req, res) => {
  try {
    // Fetching the first INSTRUCTOR for dummy auth
    const instructor = await prisma.user.findFirst({
      where: { role: "INSTRUCTOR" },
    });

    const newProblem = await prisma.problem.create({
      data: {
        title: req.body.title,
        statement: req.body.statement,
        timeLimitSec: req.body.timeLimitSec || 1,
        memoryLimitMb: req.body.memoryLimitMb || 64,
        rules: req.body.rules, // Dynamic JSON Rules
        instructorId: instructor.id,
      },
    });
    res.json({ message: "Problem created successfully!", problem: newProblem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an existing problem
app.put("/api/problems/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedProblem = await prisma.problem.update({
      where: { id },
      data: req.body,
    });
    res.json(updatedProblem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. STUDENT: Submit Code
// ==========================================
app.post("/api/submissions", async (req, res) => {
  try {
    const { problemId, code } = req.body;
    if (!problemId || !code)
      return res
        .status(400)
        .json({ error: "Problem ID and Code are required." });

    // Fetching the first STUDENT for dummy auth
    const student = await prisma.user.findFirst({ where: { role: "STUDENT" } });

    // 1. Save submission to DB as PENDING
    const submission = await prisma.submission.create({
      data: {
        problemId: problemId,
        studentId: student.id,
        code: code,
        status: "PENDING",
      },
    });

    // 2. Trigger the Agentic AutoGrader in the background (Do not await!)
    gradeSubmission(submission.id).catch((err) =>
      console.error("Agent Error:", err),
    );

    // 3. Return immediate response to Frontend
    res.json({
      message: "Submission received. Agent is grading...",
      submissionId: submission.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. STUDENT: Check Submission Status/Result
// ==========================================
app.get("/api/submissions/:id", async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: { problem: { select: { title: true } } },
    });

    if (!submission)
      return res.status(404).json({ error: "Submission not found." });
    res.json(submission);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch submission details." });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Agentic Web-SaaS APIs running on http://localhost:${PORT}`);
});
