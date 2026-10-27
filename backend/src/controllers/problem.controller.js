const problemService = require("../services/problem.service");

async function listProblems(req, res) {
  try {
    res.json(await problemService.listProblems());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch problems." });
  }
}

async function createProblem(req, res) {
  try {
    const problem = await problemService.createProblem(req.body, req.user.id);
    res.json({ message: "Problem created successfully!", problem });
  } catch (error) {
    res.status(error.statusCode || (error.code === "INVALID_RULES" ? 400 : 500)).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
}

async function updateProblem(req, res) {
  try {
    const problem = await problemService.updateProblem(req.params.id, req.body, req.user.id);
    res.json(problem);
  } catch (error) {
    res.status(error.statusCode || (error.code === "INVALID_RULES" ? 400 : 500)).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
}

module.exports = { listProblems, createProblem, updateProblem };