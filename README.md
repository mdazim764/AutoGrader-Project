# Agentic AutoGrader

Agentic AutoGrader is a full-stack grading platform for C programming assignments. It provides instructor-configurable tests and scoring rules, a student coding workspace, isolated WSL2 execution, deterministic analyzers, optional local Ollama reviews, reproducible reports, and peer-code integrity signals.

## What the system provides

- Student C editor with `.c` file upload and latest-submission restoration.
- Instructor assignment studio with public and hidden test cases.
- Configurable metric weights, complexity targets, resource limits, and integrity policy.
- WSL2-backed GCC compilation and execution with time, memory, process, file, and output controls.
- Deterministic logical test evidence containing input, expected output, actual output, and failure reason.
- Structure, modularity, complexity, memory-safety, readability, originality, and AI-style review analyzers.
- Exact normalized peer-code matching with configurable score policy.
- Review-only AI-authorship signals that never change marks.
- JSON and text student reports with hashes, tool versions, evidence, limitations, and integrity metadata.
- Instructor analytics with matched student identity for peer-copy review.

## Architecture

```mermaid
flowchart LR
    Browser[React Student / Instructor UI] --> API[Express API]
    API --> Auth[JWT and role middleware]
    API --> DB[(PostgreSQL via Prisma)]
    API --> Queue[Grading job queue]
    Queue --> Coordinator[Canonical grading coordinator]
    Coordinator --> Rules[Validated rule engine]
    Coordinator --> Sandbox[WSL2 sandbox]
    Sandbox --> GCC[GCC C11 compiler]
    Sandbox --> Runtime[Isolated executable]
    Coordinator --> Analyzers[Deterministic analyzers]
    Coordinator --> Ollama[Optional local Ollama]
    Coordinator --> Reports[JSON report contract]
    Reports --> DB
    DB --> API
```

### Grading workflow

```mermaid
sequenceDiagram
    actor Student
    participant UI as Student UI
    participant API as Express API
    participant DB as PostgreSQL
    participant Worker as Grading worker
    participant WSL as WSL2 sandbox
    participant Agents as Analyzer agents

    Student->>UI: Write/upload C source
    UI->>API: POST /api/submissions
    API->>DB: Store PENDING submission
    API->>Worker: Enqueue submission
    Worker->>DB: Atomically claim GRADING
    Worker->>DB: Load and validate rules
    Worker->>WSL: Compile with GCC
    WSL-->>Worker: Compile result and warnings
    Worker->>WSL: Run public and hidden tests
    WSL-->>Worker: Output, timeout, crash, and limit evidence
    Worker->>Agents: Run configured analyzers
    Agents-->>Worker: Scores and evidence
    Worker->>DB: Persist report and final score
    UI->>API: Poll submission report
    API-->>UI: Detailed report
```

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, Axios, Lucide |
| Backend | Node.js, Express 5, CommonJS |
| Persistence | PostgreSQL, Prisma 7, `@prisma/adapter-pg` |
| Compilation | GCC with C11 |
| Sandbox | WSL2, Bash, GNU `timeout`, Linux resource limits |
| AI review | Local Ollama HTTP API, optional |
| Testing | Node built-in test runner, Oxlint, Vite production build |

## Prerequisites

Complete the following setup before starting either application. The supported development host is
Windows 10/11 with WSL2. Run Windows commands in PowerShell and Linux commands inside the WSL
distribution.

### 1. Install Git and Node.js

Install Git for Windows and Node.js 22 LTS or newer. Confirm that both commands are available:

```powershell
git --version
node --version
npm --version
```

Node.js is used by both the Express backend and the Vite frontend. Use the same Node installation
for `npm ci`, Prisma commands, tests, and development servers.

### 2. Install and initialize PostgreSQL

Install PostgreSQL 14 or newer and make sure the PostgreSQL service is running. During installation,
record the database username and password. Create an application database using `psql`, pgAdmin, or
the PostgreSQL SQL shell:

```sql
CREATE USER autograder_user WITH PASSWORD 'replace-with-a-local-password';
CREATE DATABASE autograder OWNER autograder_user;
```

Verify the connection from PowerShell:

```powershell
psql --version
psql "postgresql://autograder_user:replace-with-a-local-password@localhost:5432/autograder" -c "SELECT version();"
```

If `psql` is not on `PATH`, run it from the PostgreSQL `bin` directory or add that directory to
the Windows `PATH`. The application does not require a separate Redis server.

### 3. Install and prepare WSL2

Install WSL2 and a supported Linux distribution from an elevated PowerShell window:

```powershell
wsl --install -d Ubuntu
```

Restart Windows if requested, then open Ubuntu once and create the Linux username and password.
Confirm that the default WSL version is 2:

```powershell
wsl --status
wsl -l -v
wsl --set-default-version 2
```

Inside Ubuntu, install the compiler and runtime utilities:

```bash
sudo apt update
sudo apt install -y bash build-essential gcc coreutils
gcc --version
timeout --version
```

The grader compiles with GCC and C11, then runs each submission inside a temporary WSL workspace.
Do not install or run student programs directly from the Windows host shell.

Verify the exact commands used by the backend:

```powershell
wsl -e bash -lc "command -v bash && command -v gcc && command -v timeout"
```

If WSL is installed but the command fails, restart WSL and retry:

```powershell
wsl --shutdown
wsl -d Ubuntu -e bash -lc "gcc --version && timeout --version"
```

### 4. Optional: install Ollama for AI reviews

Ollama is optional. Logical grading, compilation, scoring, and deterministic analyzers continue to
work without it. Install Ollama for local readability, complexity, logical-feedback, and AI-style
review assistance, then download a model:

```powershell
ollama pull llama3.1:8b
ollama list
Invoke-WebRequest http://localhost:11434/api/tags
```

The Ollama service normally listens on `http://localhost:11434`. Keep it running while grading:

```powershell
ollama serve
```

If another model is installed, set `OLLAMA_MODEL` to that exact tag. Ollama review output is advisory
and never replaces deterministic test evidence or changes marks.

### 5. Verify all prerequisites

Run this checklist before installing npm dependencies:

```powershell
git --version
node --version
npm --version
psql --version
wsl --status
wsl -e bash -lc "command -v bash && command -v gcc && command -v timeout"
Invoke-WebRequest http://localhost:11434/api/tags -UseBasicParsing
```

The last command is optional and may fail when Ollama is intentionally disabled.

## Installation

From the repository root:

```powershell
cd backend
npm ci
npx prisma generate
```

Then install the frontend:

```powershell
cd ..\frontend
npm ci
```

## Configuration

Create or update `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/autograder
DIRECT_URL=postgresql://USER:PASSWORD@localhost:5432/autograder
JWT_SECRET=replace-with-a-long-random-secret

# Optional local Ollama configuration
OLLAMA_ENDPOINT=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TIMEOUT_MS=120000
OLLAMA_RETRIES=2
OLLAMA_AI_DETECTOR_TIMEOUT_MS=120000
OLLAMA_AI_DETECTOR_RETRIES=2
```

Never commit `.env`, passwords, JWT secrets, or database credentials.

Initialize the database according to the local Prisma workflow:

```powershell
cd backend
npx prisma db push
npx prisma generate
```

## Running locally

Start the backend:

```powershell
cd backend
npm run dev
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## Verification

Backend tests and syntax:

```powershell
cd backend
npm test
npm run check
```

Frontend:

```powershell
cd frontend
npm run lint
npm run build
```

The verified backend suite covers contracts, weighted scoring, structured test input, Ollama retry behavior, WSL compilation, timeout, crash, memory enforcement, authentication, authorization, and submission ownership.

## Scoring and integrity policy

For each configured scoring metric:

```text
metric contribution = normalized score × metric weight × 100
```

Review-only AI and non-exact similarity signals have weight zero and do not change marks. Exact normalized peer matches use the assignment’s `exact_peer_match_action`, which defaults to `ZERO_SCORE`.

AI-style detection is not proof of authorship. If Ollama is unavailable, the report records a deterministic source-trait fallback and preserves the zero-mark impact.

## Important API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/problems` | List available problems |
| POST | `/api/problems` | Create an instructor problem |
| PUT | `/api/problems/:id` | Update an owned problem |
| POST | `/api/submissions` | Submit C code |
| GET | `/api/submissions/:id` | Read an authorized report |
| GET | `/api/submissions/latest?problemId=...` | Restore a student’s latest attempt |
| GET | `/api/submissions` | Instructor analytics feed |

## Repository layout

```text
backend/
  prisma/schema.prisma             Database entities
  src/contracts/                   Rules, analyzer, and report contracts
  src/rules/                       Rule loading, dispatch, and score collation
  src/sandbox/                     WSL2 execution boundary
  src/analyzers/                   Deterministic analyzers
  src/services/agents/             AI clients and agent adapters
  src/services/                    Grading coordinator and submission services
  src/controllers/ and routes/     HTTP API
  tests/                           Automated verification
frontend/
  src/pages/                       Student and instructor screens
  src/components/student/          Editor and report UI
  src/components/instructor/       Assignment and analytics UI
  src/api/                         Axios service layer
docs/
  FINAL-REPORT.md                  Detailed assignment report
  SUBMISSION-PACKAGE.md            Final packaging checklist
```

## Security and operational notes

- Student code is never executed directly by the Windows host Node process.
- Each submission receives a temporary WSL workspace.
- Submission identifiers are validated before filesystem use.
- Compilation and runtime use bounded execution.
- API reads enforce student ownership or instructor problem ownership.
- AI review is advisory and isolated from scoring.
- Runtime-generated workspaces and logs should not be committed.

## Known limitations

- WSL2 is currently a Windows-host prerequisite.
- PostgreSQL is required for the complete application workflow.
- LLM reviews depend on local model availability and are not deterministic grading evidence.
- Originality analysis is a review signal; it is not legal or definitive proof of misconduct.
- Complexity and source-structure analysis are heuristic unless the instructor defines executable criteria.
