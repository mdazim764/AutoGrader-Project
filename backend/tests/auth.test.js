const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { authenticate, isInstructor, isStudent } = require("../src/middlewares/auth.middleware");

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("authenticate rejects missing tokens", () => {
  const res = response();
  let called = false;
  authenticate({ header: () => undefined }, res, () => { called = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});

test("authenticate attaches a valid user payload", () => {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  const token = jwt.sign({ id: "student-1", role: "STUDENT" }, "test-secret");
  const req = { header: () => `Bearer ${token}` };
  const res = response();
  let called = false;
  authenticate(req, res, () => { called = true; });
  process.env.JWT_SECRET = secret;
  assert.equal(called, true);
  assert.equal(req.user.id, "student-1");
});

test("role middleware enforces instructor and student roles", () => {
  const instructorRes = response();
  isInstructor({ user: { role: "STUDENT" } }, instructorRes, () => {});
  assert.equal(instructorRes.statusCode, 403);

  const studentRes = response();
  isStudent({ user: { role: "INSTRUCTOR" } }, studentRes, () => {});
  assert.equal(studentRes.statusCode, 403);
});
