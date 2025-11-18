Incident Co-Pilot

Incident Co-Pilot is a small incident management app with a bit of AI on top.

You can:

Create and list incidents (with status + severity)

Search and filter incidents

Store vector embeddings in Postgres (pgvector) and run similarity search

Ask the AI to suggest / summarize incidents

Chat with an AI assistant:

per incident (contextual to one incident + similar ones)

or globally (questions about the list of incidents)

1. Architecture
   1.1 Monorepo layout
   .
   ├─ apps/
   │  ├─ api/        # NestJS API (REST) + Prisma + Postgres (pgvector)
   │  ├─ web/        # Next.js (App Router) front-end
   │  └─ ai/         # FastAPI microservice that talks to OpenAI
   └─ infra/
   └─ docker/
   ├─ docker-compose.yml
   ├─ api.env
   ├─ web.env
   ├─ ai.env
   └─ *.env.example

1.2 Tech stack

API: NestJS 11, Prisma, Postgres + pgvector

Front-end: Next.js (App Router), React, inline styles (no Tailwind)

AI service: FastAPI (Python), official OpenAI client

Infra: Docker + Docker Compose (Postgres, Redis, MinIO, y-websocket, AI, API, Web)

2. Main features
   2.1 Incidents

Incident schema (simplified):

title

description

status (OPEN, ACKNOWLEDGED, MITIGATING, RESOLVED, CLOSED)

severity (SEV1…SEV5)

createdAt

Status workflow:

OPEN → ACKNOWLEDGED → MITIGATING → RESOLVED → CLOSED


Status transitions are enforced in the API

PATCH on status is controlled by an env flag: ALLOW_STATUS_PATCH

2.2 Embeddings & similarity

Local embeddings:

simple hashed bag-of-words

768 dimensions

Stored in Postgres using pgvector (vector column)

Similarity search:

ORDER BY embedding <=> query_vec
LIMIT k


Used for “similar incidents” on the API and UI.

2.3 AI behaviour

AI microservice (apps/ai) implements:

POST /incident-suggest

POST /incident-chat

POST /assistant-query and POST /assistant/query

It uses OpenAI (e.g. gpt-4o-mini) via OPENAI_API_KEY

The AI service combines:

simple local heuristics (severity, tags, base summary)

real LLM calls with safe fallback (if OpenAI is down, you still get a heuristic answer)

On the API side (NestJS):

IncidentsService.suggest:

runs a local heuristic (regex / keywords)

calls the AI service /incident-suggest

merges both results and falls back if there is an error

IncidentsService.summary:

reuses suggest(...) for a given incident

returns { summary, severityProposed, statusProposed, tags, confidence }

IncidentsService.chat:

fetches the incident

fetches similar incidents (via embeddings)

sends everything to /incident-chat (AI service)

AssistantService.query:

fetches recent incidents from the DB

calls /assistant-query (AI service)

the AI uses this list as ground truth when answering questions about incidents

3. Running with Docker
   3.1 Prerequisites

Docker

Docker Compose

3.2 Environment files

In infra/docker/ you should have:

api.env

web.env

ai.env

There may also be .env.example files you can copy.

Example infra/docker/api.env:

# Postgres inside Docker
DATABASE_URL=postgresql://copilot:copilot@postgres:5432/copilot?schema=public

# Simple API key used by web + dev tools
API_KEY=dev-secret-123

# Where the AI microservice is reachable from the API container
AI_BASE=http://ai:8000

# Allow or block PATCH /incidents/:id (status updates)
ALLOW_STATUS_PATCH=false


Example infra/docker/ai.env:

AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini


Example infra/docker/web.env:

# For server-side calls from Next.js (inside the web container)
API_BASE_INTERNAL=http://api:3001

# For the browser (outside Docker)
NEXT_PUBLIC_API_BASE=http://localhost:3001

# Same key as in api.env
API_KEY=dev-secret-123

# Enable or disable the "Update status" button in the UI
ENABLE_STATUS_UPDATE=false

3.3 Start all services

From the repo root:

cd infra/docker
docker compose -f docker-compose.yml up -d --build


Main services and ports:

Web front-end: http://localhost:3000

API (Nest): http://localhost:3001

AI service (FastAPI): http://localhost:8000

Check container status:

docker compose -f docker-compose.yml ps

4. API (NestJS)

All API routes expect an x-api-key header with the value of API_KEY from api.env.

Base URL in dev: http://localhost:3001

4.1 Incidents
GET /incidents

Paginated list with filters.

Query params:

status — CSV, e.g. OPEN,CLOSED

severity — CSV, e.g. SEV1,SEV2

q — full-text search in title/description (contains, case-insensitive)

sort — one of createdAt | title | status | severity

dir — asc or desc

page — page index (1-based)

pageSize — items per page

Response:

{
"items": [
{
"id": "cmi1l2dq00001my01zsgddk6b",
"title": "Test incident LLM",
"description": "Example incident",
"status": "OPEN",
"severity": "SEV3",
"createdAt": "2025-11-16T10:39:01.366Z"
}
],
"page": 1,
"pageSize": 10,
"total": 19,
"totalPages": 2
}

POST /incidents

Create a new incident.

Body example:

{
"title": "Payment outage",
"description": "Users get 5xx during checkout",
"severity": "SEV2",
"status": "OPEN"
}


On create:

default severity is SEV3 if not provided

default status is OPEN if not provided

the API auto-triggers an embedding rebuild in the background

GET /incidents/:id

Get a single incident by ID.

404 if incident does not exist

PATCH /incidents/:id

Update status only.

Enabled only if ALLOW_STATUS_PATCH=true

Enforces the workflow:

OPEN → ACKNOWLEDGED

ACKNOWLEDGED → MITIGATING

MITIGATING → RESOLVED

RESOLVED → CLOSED

CLOSED → CLOSED (no further transitions)

Error cases:

403 if ALLOW_STATUS_PATCH is false

409 on illegal transition

404 if incident does not exist

4.2 Embeddings & similarity
POST /incidents/:id/embedding

Recompute and store the embedding for a specific incident.

Uses local embedding (no external API call)

Updates the embedding vector column in Postgres

Returns:

{
"ok": true
}


or 404 if incident does not exist.

POST /incidents/embeddings/rebuild

Rebuild embeddings for all incidents.

Iterates over the incidents in batches, calls the same logic as above.

Example response:

{
"total": 19,
"ok": 19
}

GET /incidents/similar?q=...&k=5

Search for similar incidents based on text.

q: query text (required)

k: number of results (default 5, max 20)

Response:

{
"items": [
{
"id": "cmi1l2dq00001my01zsgddk6b",
"title": "Test incident LLM",
"description": "Example incident",
"status": "OPEN",
"severity": "SEV3",
"createdAt": "2025-11-16T10:39:01.366Z",
"score": 0.012345
}
]
}


score is the pgvector distance (<=>), lower is more similar.

4.3 AI endpoints (via the API)
POST /incidents/suggest

Ask the API for incident suggestions (heuristics + AI).

Body:

{
"title": "Payment service timeout",
"description": "Users in EU-West cannot pay, 5xx on checkout API."
}


Response:

{
"summary": "...",
"suggestedTitle": "...",
"impactSummary": "...",
"actionItems": ["..."],
"severityProposed": "SEV2",
"statusProposed": "OPEN",
"tags": ["api", "eu-west"],
"confidence": 0.7
}

GET /incidents/:id/summary

Returns an AI-based summary for a specific incident.

Example:

{
"id": "cmi1l2dq00001my01zsgddk6b",
"summary": "Short summary of the incident...",
"severityProposed": "SEV2",
"statusProposed": "OPEN",
"tags": ["api", "checkout"],
"confidence": 0.6
}

POST /incidents/:id/chat

Chat with the AI assistant about a single incident.

Body:

{
"messages": [
{ "role": "user", "content": "Give me a quick summary of this incident." }
]
}


The API:

fetches the incident from the DB

finds similar incidents using embeddings

sends all of that to the AI microservice (/incident-chat)

Response:

{
"reply": "..."
}


If the AI service is down, the API returns a friendly fallback message in English.

5. AI microservice (FastAPI)

Base URL (from host): http://localhost:8000

5.1 Health
GET /health

Example response:

{
"status": "ok",
"service": "ai",
"provider": "openai"
}

5.2 Incident suggestion
POST /incident-suggest

(also available as /incidents/suggest)

Body:

{
"title": "Payment service timeout",
"description": "Users in EU-West cannot pay, 5xx on checkout API."
}


Response structure matches the SuggestResult returned by the API:

{
"summary": "...",
"suggestedTitle": "...",
"impactSummary": "...",
"actionItems": ["..."],
"severityProposed": "SEV2",
"statusProposed": "OPEN",
"tags": ["api", "eu-west"],
"confidence": 0.7
}


If OpenAI is not available, the service falls back to a simple heuristic.

5.3 Incident chat
POST /incident-chat

Body:

{
"incident": {
"id": "123",
"title": "Payment outage",
"description": "5xx on checkout",
"severity": "SEV2",
"status": "OPEN"
},
"similar_incidents": [
{
"id": "prev-1",
"title": "Previous payment outage",
"description": "Last month, EU-West outage.",
"severity": "SEV2",
"status": "RESOLVED"
}
],
"messages": [
{ "role": "user", "content": "What can we learn from similar incidents?" }
]
}


Response:

{
"reply": "..."
}


If OpenAI is not configured, it returns a simple text reply with basic guidance.

5.4 Global assistant
POST /assistant-query

(or /assistant/query)

Body:

{
"question": "Which SEV2 incidents happened this week?",
"incidents": [
{
"id": "i1",
"title": "Outage 1",
"description": "…",
"severity": "SEV2",
"status": "RESOLVED",
"createdAt": "2025-11-10T10:00:00Z"
}
]
}


The assistant:

can answer general questions (like a normal chat assistant)

when the question is about incidents, it uses the incidents array as ground truth

does not invent new incidents

Response:

{
"reply": "..."
}

6. Front-end (Next.js)

Base URL: http://localhost:3000

6.1 /incidents

Main incidents list page:

Search bar:

searches in title and description

Filters:

by status: OPEN, ACKNOWLEDGED, MITIGATING, RESOLVED, CLOSED

by severity: SEV1…SEV5

Sorting:

by title, severity, status, created date

Pagination:

shows “start–end of total incidents”

“Prev” and “Next” buttons

Coloured badges:

severity and status have visible colour codes

Top mini navigation:

Incident Co-Pilot (logo/title)

Incidents

Global assistant

Button + New incident → /incidents/new

If there are no incidents:

shows a friendly empty state message

6.2 /incidents/new

Create incident page:

Form fields:

title, description, severity, status

Buttons:

Suggest:

calls API /incidents/suggest

shows:

suggestedTitle

impactSummary

actionItems

severityProposed

statusProposed

tags

confidence

Find similar:

calls /incidents/similar?q=&k=5

shows up to 5 similar incidents

Create:

calls POST /incidents

redirects to /incidents

6.3 /incidents/[id]

Incident details page:

Summary card:

AI-generated summary from /incidents/:id/summary

chips for severityProposed, statusProposed, tags, confidence

a “Raw JSON” block with the full summary object (for debugging)

“AI assistant for this incident” card:

small chat UI with bubbles:

“You” on the right

“AI” on the left

calls /incidents/:id/chat

displays clean error messages if AI service is unavailable

6.4 /assistant

Global assistant page:

Mini header with back link to /incidents

Examples of questions (e.g. “Which SEV1 incidents happened this week?”)

Textarea for the question

“Ask” button

Answer card:

shows:

AI reply

or an error message

or “No answer yet…”

7. Quick manual test checklist

Before pushing to GitHub, you can run this small checklist:

docker compose -f infra/docker/docker-compose.yml ps → all main services are Up

GET /incidents returns a paginated list

POST /incidents creates an incident

PATCH /incidents/:id:

returns 403 when ALLOW_STATUS_PATCH=false

works for a valid transition when ALLOW_STATUS_PATCH=true

POST /incidents/:id/embedding works

POST /incidents/embeddings/rebuild works (e.g. ok = total)

GET /incidents/similar returns at least the queried incident itself and a score

GET /incidents/:id/summary returns a valid summary object

POST /incidents/:id/chat returns { reply } both when AI is up and with a nice fallback when it is down

Front /incidents:

search, filters, sorting, pagination all work

/incidents/new:

Suggest, Find similar, Create all work

/incidents/[id]:

summary and chat render correctly

/assistant:

answers incident-related questions based on the real list (no invented incidents)

8. Possible future improvements

Some ideas if you want to extend the project:

Add a timeline and “event log” on the incident details page

Show the list of similar incidents directly under the incident chat

Add loading spinners on Summary / Chat / Assistant cards

Add simple unit / e2e tests:

status transition logic

AI fallbacks when the AI service is down

global assistant behaviour for incident questions