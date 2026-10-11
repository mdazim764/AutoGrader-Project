require("dotenv").config(); // Load environment variables first
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

// Initialize the Database Adapter for Prisma 7
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting Database Seeding...");

  // 1. Clear existing data
  await prisma.submission.deleteMany({});
  await prisma.problem.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("🧹 Cleared old data.");

  // 2. Create Instructor and Student
  const instructor = await prisma.user.create({
    data: {
      name: "Dr. Smith (Instructor)",
      email: "smith@university.edu",
      role: "INSTRUCTOR",
    },
  });

  const student = await prisma.user.create({
    data: {
      name: "Azim Khairdi",
      email: "azim@student.edu",
      role: "STUDENT",
    },
  });
  console.log("👤 Users Created!");

  // 3. Create the Problem
  const problem = await prisma.problem.create({
    data: {
      title: "Add Two Integers Safely",
      statement:
        "Read two integers separated by space. Print their sum. Handle large integers properly to avoid overflow.",
      timeLimitSec: 1,
      memoryLimitMb: 64,
      instructorId: instructor.id,
      rules: {
        metrics: [
          {
            name: "logical",
            weight: 0.4,
            params: { cases: ["basic", "negatives", "zero", "int_overflow"] },
          },
          {
            name: "readability",
            weight: 0.2,
            params: { model: "llama3.1:8b", temperature: 0 },
          },
          {
            name: "complexity",
            weight: 0.4,
            params: { required: "O(1)" },
          },
        ],
      },
    },
  });
  console.log("📝 Problem Created in Database!");

  // 4. Create a Pending Submission
  const submission = await prisma.submission.create({
    data: {
      studentId: student.id,
      problemId: problem.id,
      status: "PENDING",
      code: `#include <stdio.h>\nint main() {\n  long long a, b;\n  scanf("%lld %lld", &a, &b);\n  printf("%lld\\n", a + b);\n  return 0;\n}`,
    },
  });
  console.log("📄 Dummy Submission Created!");

  console.log("\n✅ Seeding Complete! Ready for Agentic Testing.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Close the connection pool
  });
