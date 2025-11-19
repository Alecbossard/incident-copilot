# Incident Co-Pilot

Incident Co-Pilot is a small **incident management** app with a bit of **AI** on top.

You can:

- Create and list incidents (with status + severity)
- Search and filter incidents
- Store vector embeddings in Postgres (pgvector) and run similarity search
- Ask the AI to **suggest / summarize** incidents
- Chat with an AI assistant:
  - per incident (contextual to one incident + similar ones)
  - or globally (questions about the whole list of incidents)

---

## 1. Architecture

Monorepo layout:

```text
incident-copilot/
├─ apps/
│  ├─ api/      # NestJS API (REST) + Prisma + Postgres (pgvector)
│  ├─ web/      # Next.js (App Router) front-end
│  └─ ai/       # FastAPI microservice that talks to OpenAI
└─ infra/
   └─ docker/
      ├─ docker-compose.yml
      ├─ api.env.example
      ├─ web.env.example
      └─ ai.env.example
```

### 1.1 Tech stack

- **API**: NestJS 11, Prisma, Postgres + pgvector  
- **Front-end**: Next.js (App Router), React, inline styles (no Tailwind)  
- **AI service**: FastAPI (Python), official OpenAI client  
- **Infra**: Docker Compose (Postgres, Redis, MinIO, y-websocket, AI, API, Web)

---

## 2. Features

### 2.1 Incidents

- Create incidents with:
  - `title` (required)
  - `description`
  - `severity`: `SEV1`…`SEV5`
  - `status`: `OPEN`, `ACKNOWLEDGED`, `MITIGATING`, `RESOLVED`, `CLOSED`
- Server-side pagination + filters:
  - filter by status / severity
  - text search on title/description
  - sort by created date, title, status, severity

### 2.2 Vector search (pgvector)

- Local **bag-of-words** embedding (768-dim) computed in the API
- Embeddings stored in Postgres vector column (`pgvector`)
- Similarity search endpoint:
  - `GET /incidents/similar?q=...&k=5`
- Rebuild embeddings for all incidents:
  - `POST /incidents/embeddings/rebuild`

### 2.3 AI suggestion & summary

- Endpoint `POST /incidents/suggest`
  - Simple heuristic (regex + tags + severity guess)
  - Calls the Python `ai` service to refine the suggestion (OpenAI)
  - Returns:
    - `summary`
    - `suggestedTitle`
    - `impactSummary`
    - `actionItems[]`
    - `severityProposed`, `statusProposed`
    - `tags[]`, `confidence`
- Endpoint `GET /incidents/:id/summary`
  - Reuses the same suggestion logic to generate an AI summary for one incident

### 2.4 AI chat

- **Per-incident chat**:

  - `POST /incidents/:id/chat`
  - API sends `{ incident, similar_incidents, messages }` to the `ai` microservice
  - Microservice calls OpenAI and returns a reply
  - Front-end shows a mini chat UI (“You” vs “AI” bubbles)

- **Global assistant**:

  - `/assistant` page on the front-end
  - API collects the latest incidents and calls `ai`:
    - `POST /assistant/query`
  - Assistant can answer:
    - questions about incidents (`Which SEV1 incidents happened this week?`)
    - general questions (acts like a normal chatbot)

---

## 3. Demo (GIFs)

### 3.1 Creating a new incident

This short demo shows how to:

- Open the incidents page
- Use the search
- Create a new incident with AI suggestion and similar incidents
- See the newly created incident in the list

![Demo – Create incident](docs/demo-create-incident.gif)

---

### 3.2 AI assistant on a single incident

This demo shows the per-incident AI features:

- Viewing the AI-generated summary for an incident
- Asking the “AI assistant for this incident” for root causes and next steps
- Asking about similar past incidents and mitigations

![Demo – Incident AI assistant](docs/demo-incident-assistant.gif)

---

### 3.3 Global assistant

This demo shows the global AI assistant:

- Asking a question about existing incidents (for example: “Which SEV1 incidents exist in the system?”)
- Getting a synthesized answer based on the incident history

![Demo – Global assistant](docs/demo-global-assistant.gif)

---

## 4. API (apps/api)

Main endpoints (simplified):

```text
GET    /incidents                     # list, with filters & pagination
POST   /incidents                     # create incident
PATCH  /incidents/:id                 # update status (controlled transitions)
GET    /incidents/:id                 # get one incident
POST   /incidents/:id/embedding       # recompute vector embedding
GET    /incidents/similar             # vector similarity search
GET    /incidents/:id/summary         # AI summary
POST   /incidents/:id/chat            # incident-scoped AI chat
POST   /incidents/embeddings/rebuild  # rebuild all embeddings

POST   /assistant/query               # global assistant (via AI service)
GET    /health                        # basic healthcheck
```

Status transitions are restricted:

```text
OPEN -> ACKNOWLEDGED -> MITIGATING -> RESOLVED -> CLOSED
```

Status patching can be disabled via environment variable:

```text
ALLOW_STATUS_PATCH=false
```

Security: a simple `x-api-key` header is required for API calls.

---

## 5. Front-end (apps/web)

### 5.1 `/incidents`

- Paginated table of incidents
- Search bar + filters (status / severity)
- Sort by title, severity, status, created date
- Badges with colors for severity and status
- Button “+ New incident”
- Button “Global assistant” in the header
- Small empty state when there are no incidents

### 5.2 `/incidents/new`

- Form to create a new incident
- Buttons:
  - **Suggest** – calls `/api/incidents/suggest`
  - **Find similar** – calls `/api/incidents/similar`
  - **Create** – calls `/api/incidents`
- Shows:
  - Suggested title (with “Use suggested title” button)
  - Impact summary, action items
  - Tags + proposed severity/status + confidence
  - List of similar incidents (title, truncated description, score)

### 5.3 `/incidents/[id]`

- “Summary” card:
  - AI summary
  - Proposed severity/status, tags, confidence
  - Raw JSON block with the summary payload
- “AI assistant for this incident”:
  - mini chat UI
  - uses `/api/incidents/[id]/chat`

### 5.4 `/assistant`

- Global assistant page:
  - simple explanation / examples
  - textarea for the question
  - “Ask” button
  - card showing either:
    - AI answer
    - or an error (“assistant unavailable…”)
- If the AI service cannot reach the LLM (e.g., missing API key), the microservice returns a **fallback summary** and a clear message instead of failing.

---

## 6. AI service (apps/ai)

FastAPI app exposing:

```text
GET  /health
POST /incident-chat
POST /incident-suggest
POST /assistant-query
POST /assistant/query    # alias
```

- Uses `OPENAI_API_KEY` and `OPENAI_MODEL` (default: `gpt-4o-mini`)
- If `AI_PROVIDER=openai`, uses the official OpenAI client
- Otherwise, falls back to simple, deterministic logic (no external calls)

The service:

- **incident-chat**:
  - builds a prompt with incident details + similar incidents
  - returns a single text reply
- **incident-suggest**:
  - heuristic suggestion + optional refinement by OpenAI
- **assistant-query**:
  - global assistant that can use a list of incidents as context

If the upstream LLM is unavailable (no key / invalid key / provider error), the service responds with a graceful fallback message so the UI can still render something useful instead of crashing.

---

## 7. Running with Docker (local)

### 7.1 Prerequisites

- Docker + Docker Compose
- pnpm (only if you want to run parts locally, not strictly required for Docker)

### 7.2 Environment

Check the example env files:

- Root: `.env.example`
- Infra: `infra/docker/api.env.example`, `web.env.example`, `ai.env.example`
- API: `apps/api/.env.example`

Create real `.env` files **locally** (do not commit them):

```bash
cp .env.example .env
cp infra/docker/api.env.example infra/docker/api.env
cp infra/docker/web.env.example infra/docker/web.env
cp infra/docker/ai.env.example infra/docker/ai.env
# fill in OPENAI_API_KEY etc.
```

### 7.3 Start the stack (local)

From the `infra/docker` folder:

```bash
docker compose up --build
```

Default ports (local machine):

- API: `http://localhost:3001`
- Web: `http://localhost:3000`
- AI service: `http://localhost:8000`
- Postgres (pgvector): `localhost:5432`

You can then open the web UI on `http://localhost:3000`.

---

## 8. Development (local, without Docker)

Example (API only):

```bash
cd apps/api
pnpm install
pnpm run prisma:generate
pnpm run start:dev
```

Example (web only):

```bash
cd apps/web
pnpm install
pnpm dev
```

> In practice, the recommended way to run the full app is still via Docker Compose.

---

## 9. Example deployment on AWS EC2 (demo)

This project can be deployed as a small “all-in-one” stack on a single EC2 instance using Docker Compose.

### 9.1 High-level approach

- 1× EC2 instance (Ubuntu)
- Install Docker + Docker Compose
- Clone the repository
- Create production `.env` files in `infra/docker/`
- Run `docker-compose up -d`
- Expose the web app on port 80 (mapped to the Next.js container port)

### 9.2 Minimal steps (manual, non-automated)

On the EC2 instance (Ubuntu):

```bash
# Update and install Docker + docker-compose
sudo apt update
sudo apt install -y docker.io docker-compose git

# (optional) add your user to docker group
sudo usermod -aG docker $USER
# then log out / log back in
```

Clone the project:

```bash
cd ~
git clone https://github.com/<your-username>/incident-copilot.git
cd incident-copilot/infra/docker
```

Create production env files (never commit these):

```bash
cp api.env.example api.env
cp web.env.example web.env
cp ai.env.example ai.env
```

Then edit:

- `api.env` (inside `infra/docker/`), for example:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://copilot:copilot@postgres:5432/copilot
CORS_ORIGIN=http://YOUR_EC2_PUBLIC_IP
API_KEY=dev-secret-123
EMB_FALLBACK=local
ALLOW_STATUS_PATCH=false
AI_BASE=http://ai:8000
```

- `web.env`:

```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_BASE=http://YOUR_EC2_PUBLIC_IP:3001
API_BASE_INTERNAL=http://api:3001
API_KEY=dev-secret-123
ENABLE_STATUS_UPDATE=false
```

- `ai.env`:

```env
API_BASE=http://api:3001
API_KEY=dev-secret-123
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...your_key_here...
```

In `docker-compose.yml`, you can optionally map the web container to port 80:

```yaml
  web:
    # ...
    ports:
      - "80:3000"
```

Then start the stack:

```bash
cd infra/docker
docker-compose up -d --build
```

You should now be able to open:

- `http://YOUR_EC2_PUBLIC_IP/` → Next.js front-end
- `http://YOUR_EC2_PUBLIC_IP/incidents` → incidents UI
- The front-end talks to the API and AI service through the Docker network.

When you update the code and push to GitHub, you can redeploy by:

```bash
cd ~/incident-copilot
git pull
cd infra/docker
docker-compose down
docker-compose up -d --build
```

> This is intentionally a **simple, single-instance deployment** meant for demo / portfolio purposes, not a production-grade setup (no HTTPS, no autoscaling, no managed database, etc.).

---

## 10. Notes / Limitations

- This is a **student / demo project**, not production-ready.
- Security is minimal:
  - simple `x-api-key` on the API
  - no auth / RBAC / multi-tenant separation
- Embeddings are simple bag-of-words vectors, not true transformer embeddings.
- Error handling is basic but tries to always return a clear message to the UI.
- The AI microservice is designed to **fail gracefully**:
  - if the LLM cannot be reached, it still returns a text explanation and/or a basic summary instead of crashing, so the UI remains usable.

---

## 11. License

No explicit license yet.  
For now, treat this as “look at the code, don’t use in production without permission”.
