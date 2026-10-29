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

Install the following before running the application:

1. Node.js 22 or newer.
2. PostgreSQL 14 or newer.
3. Windows Subsystem for Linux 2.
4. A WSL Linux distribution with:
   - `bash`
   - `gcc`
   - GNU `timeout` from `coreutils`
5. Ollama is optional. It is required only for LLM-assisted reviews; deterministic grading continues if it is unavailable.

Verify WSL:

```powershell
wsl --status
wsl -e bash -lc "command -v bash && command -v gcc && command -v timeout"
```

Verify Ollama if enabled:

```powershell
Invoke-WebRequest http://localhost:11434/api/tags
ollama list
```

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

See [docs/FINAL-REPORT.md](docs/FINAL-REPORT.md) for the complete architecture, workflow, scoring, testing evidence, and assignment mapping.
