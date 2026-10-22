const express = require("express");
const router = express.Router();
const { authenticate, isInstructor } = require("../middlewares/auth.middleware");
const {
  listProblems,
  createProblem,
  updateProblem,
} = require("../controllers/problem.controller");

router.get("/", listProblems);
router.post("/", authenticate, isInstructor, createProblem);
router.put("/:id", updateProblem);

module.exports = router;
