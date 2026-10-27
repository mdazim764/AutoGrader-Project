const jwt = require("jsonwebtoken");

// Token verify karne ke liye
const authenticate = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Access Denied. No token provided." });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // Isme user.id aur user.role aayega
    next();
  } catch (error) {
    res.status(400).json({ error: "Invalid Token" });
  }
};

// Instructor Role check karne ke liye
const isInstructor = (req, res, next) => {
  if (req.user.role !== "INSTRUCTOR") {
    return res
      .status(403)
      .json({
        error: "Access Denied. Only Instructors can perform this action.",
      });
  }
  next();
};

const isStudent = (req, res, next) => {
  if (req.user.role !== "STUDENT") {
    return res.status(403).json({ error: "Access denied. Students only." });
  }
  next();
};

module.exports = { authenticate, isInstructor, isStudent };
