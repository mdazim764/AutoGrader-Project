require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs"); // For realistic passwords

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting Advanced Database Seeding...");

  // 1. Wipe old data
  await prisma.submission.deleteMany({});
  await prisma.problem.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("🧹 Cleared old data.");

  const defaultPassword = await bcrypt.hash("password123", 10);

  // 2. Create Instructor
  const instructor = await prisma.user.create({
    data: {
      name: "Dr. Alan Turing",
      email: "alan@iitp.ac.in",
      password: defaultPassword,
      role: "INSTRUCTOR",
    },
  });

  // 3. Create 3 Students
  const s1 = await prisma.user.create({
    data: {
      name: "Azim Khairdi",
      email: "azim@iitp.ac.in",
      password: defaultPassword,
      role: "STUDENT",
    },
  });
  const s2 = await prisma.user.create({
    data: {
      name: "Rahul Sharma",
      email: "rahul@iitp.ac.in",
      password: defaultPassword,
      role: "STUDENT",
    },
  });
  const s3 = await prisma.user.create({
    data: {
      name: "Cheater Chintu",
      email: "chintu@iitp.ac.in",
      password: defaultPassword,
      role: "STUDENT",
    },
  });

  console.log("👤 Users Created!");

  // 4. Create a Course & Enroll Students
  const course = await prisma.course.create({
    data: {
      name: "CS5101: Design and Analysis of Algorithms",
      code: "CS5101",
      instructorId: instructor.id,
      students: { connect: [{ id: s1.id }, { id: s2.id }, { id: s3.id }] },
    },
  });
  console.log("🏫 Course created & Students Enrolled!");

  // 5. Create a Problem assigned to this Course
  const problem = await prisma.problem.create({
    data: {
      title: "Add Two Integers Safely",
      statement:
        "Read two integers separated by space. Print their sum. Handle large integers properly to avoid overflow.",
      courseId: course.id,
      instructorId: instructor.id,
      rules: {
        metrics: [
          {
            name: "logical",
            weight: 0.4,
            params: { cases: ["basic", "negatives", "int_overflow"] },
          },
          { name: "complexity", weight: 0.6, params: { required: "O(1)" } },
        ],
      },
    },
  });

  // 6. 🚀 SEEDING REALISTIC SUBMISSIONS 🚀

  // Student 1 (Azim) - Perfect Submission (Attempt 1)
  const subAzim = await prisma.submission.create({
    data: {
      studentId: s1.id,
      problemId: problem.id,
      status: "COMPLETED",
      finalScore: 100,
      attemptNumber: 1,
      code: `#include <stdio.h>\nint main() {\n  long long a, b;\n  scanf("%lld %lld", &a, &b);\n  printf("%lld\\n", a + b);\n  return 0;\n}`,
      report: { feedback: "Excellent code, optimal complexity!" },
    },
  });

  // Student 2 (Rahul) - Failed First Attempt
  await prisma.submission.create({
    data: {
      studentId: s2.id,
      problemId: problem.id,
      status: "FAILED",
      finalScore: 40,
      attemptNumber: 1,
      code: `#include <stdio.h>\nint main() {\n  int a, b;\n  scanf("%d %d", &a, &b);\n  printf("%d\\n", a + b);\n  return 0;\n}`, // Used 'int', fails overflow
      report: { error: "Failed logical test: Integer Overflow" },
    },
  });

  // Student 2 (Rahul) - Corrected in Second Attempt
  await prisma.submission.create({
    data: {
      studentId: s2.id,
      problemId: problem.id,
      status: "COMPLETED",
      finalScore: 100,
      attemptNumber: 2,
      code: `#include <stdio.h>\nint main() {\n  long long x, y;\n  scanf("%lld %lld", &x, &y);\n  printf("%lld\\n", x + y);\n  return 0;\n}`,
    },
  });

  // Student 3 (Chintu) - Copied Azim's code exactly! (Plagiarism Flagged)
  await prisma.submission.create({
    data: {
      studentId: s3.id,
      problemId: problem.id,
      status: "COMPLETED",
      finalScore: 0,
      attemptNumber: 1,
      isPlagiarized: true,
      plagiarismScore: 98.5,
      matchedWithId: subAzim.id, // Linked to Azim's submission
      code: `#include <stdio.h>\nint main() {\n  long long a, b;\n  scanf("%lld %lld", &a, &b);\n  printf("%lld\\n", a + b);\n  return 0;\n}`,
      report: {
        warning: "🚨 FLAGGED FOR PLAGIARISM: 98.5% match with another student.",
      },
    },
  });

  console.log("📄 Realistic Submissions (with Attempts & Plagiarism) Seeded!");
  console.log("\n✅ Database is now loaded with a full Classroom environment!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
