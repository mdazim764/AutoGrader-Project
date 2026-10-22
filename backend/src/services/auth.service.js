const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/user.repository");

async function login(email, password) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    return { status: 404, body: { error: "User not found!" } };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return { status: 401, body: { error: "Invalid credentials!" } };
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET || "supersecretkey",
    { expiresIn: "1d" },
  );

  return {
    status: 200,
    body: {
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    },
  };
}

module.exports = { login };
