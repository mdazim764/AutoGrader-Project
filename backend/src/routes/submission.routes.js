// Backend: Get All Submissions (For Instructor Analytics)
app.get("/api/submissions", authenticate, async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      include: {
        student: { select: { name: true, email: true } },
        problem: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" }, // Sabse latest pehle aayega
    });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch submissions." });
  }
});
