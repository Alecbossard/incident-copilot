import os
import json
from collections import Counter
from typing import List, Optional, Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

# =======================
#  Config / OpenAI client
# =======================

try:
    from openai import OpenAI  # official OpenAI client
except ImportError:  # in case the lib isn't installed yet
    OpenAI = None  # type: ignore

AI_PROVIDER = (os.getenv("AI_PROVIDER") or os.getenv("LLM_PROVIDER") or "local").lower()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

openai_client = None
if AI_PROVIDER == "openai" and OPENAI_API_KEY and OpenAI is not None:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="Incident Copilot AI")

# ============
#  Pydantic models
# ============

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class IncidentForChat(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None


class IncidentChatRequest(BaseModel):
    incident: IncidentForChat
    similar_incidents: List[IncidentForChat] = Field(default_factory=list)
    messages: List[ChatMessage] = Field(default_factory=list)


class IncidentChatResponse(BaseModel):
    reply: str


class IncidentSuggestRequest(BaseModel):
    title: Optional[str] = ""
    description: Optional[str] = ""


class IncidentSuggestResponse(BaseModel):
    summary: str
    suggestedTitle: str
    impactSummary: str
    actionItems: List[str]
    severityProposed: str
    statusProposed: str
    tags: List[str]
    confidence: float


class AssistantIncident(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: Optional[str] = None
    severity: Optional[str] = None
    createdAt: Optional[str] = None


class AssistantQueryRequest(BaseModel):
    question: str
    incidents: Optional[List[AssistantIncident]] = None


class AssistantQueryResponse(BaseModel):
    reply: str


# =======================
#  Shared heuristics
# =======================

TAG_PATTERNS = [
    "api",
    "billing",
    "auth",
    "db",
    "database",
    "sql",
    "cache",
    "redis",
    "queue",
    "kafka",
    "cdn",
    "network",
    "eu-west",
    "us-east",
    "latency",
    "5xx",
    "timeout",
]


def guess_severity(text: str) -> str:
    t = text.lower()
    if any(w in t for w in ["sev1", "p1", "major outage", "data loss", "total outage"]):
        return "SEV1"
    if any(w in t for w in ["sev2", "p2", "outage", "5xx", "downtime", "critical"]):
        return "SEV2"
    if any(w in t for w in ["sev4", "minor", "degraded"]):
        return "SEV4"
    if any(w in t for w in ["sev5", "cosmetic", "typo", "ui"]):
        return "SEV5"
    return "SEV3"


def extract_tags(text: str) -> List[str]:
    t = text.lower()
    tags = [w for w in TAG_PATTERNS if w in t]
    seen = set()
    out: List[str] = []
    for tag in tags:
        if tag not in seen:
            out.append(tag)
            seen.add(tag)
    return out[:8]


def build_basic_summary(title: str, description: str) -> str:
    title = (title or "").strip()
    description = (description or "").strip()
    base = title or (description[:80] if description else "Incident")
    if description and description != base:
        tail = description[:140]
        if len(description) > 140:
            tail += "…"
        return f"{base} — {tail}"
    return base


# ==========================
#  /incident-chat helpers
# ==========================

def basic_incident_chat_reply(req: IncidentChatRequest) -> str:
    inc = req.incident
    last_user_msg = ""
    for m in reversed(req.messages):
        if m.role == "user":
            last_user_msg = m.content
            break

    lines: List[str] = []
    lines.append(f"I am the incident AI assistant for incident #{inc.id}.")
    lines.append("")
    lines.append(f"Title: {inc.title}")
    lines.append(f"Severity: {inc.severity} | Status: {inc.status}")
    if inc.description:
        lines.append("")
        lines.append(f"Description: {inc.description}")

    if last_user_msg:
        lines.append("")
        lines.append(f"Last question: {last_user_msg}")
        lines.append("")
        lines.append("Example next steps:")
        lines.append("- Check logs and metrics around the time of the incident.")
        lines.append("- Verify recent deployments or configuration changes.")
        lines.append("- Communicate current status to stakeholders.")

    return "\n".join(lines)


def llm_incident_chat(req: IncidentChatRequest) -> str:
    if not openai_client:
        return basic_incident_chat_reply(req)

    inc = req.incident
    similar = req.similar_incidents or []

    # On formate un peu mieux les similar incidents
    similar_lines: List[str] = []
    for s in similar[:5]:
        short_desc = (s.description or "").strip()
        if len(short_desc) > 180:
            short_desc = short_desc[:180] + "…"

        similar_lines.append(
            f"- [{s.id}] {s.title} (status={s.status}, severity={s.severity})"
        )
        if short_desc:
            similar_lines.append(f"  Description: {short_desc}")

    # System prompt beaucoup plus clair
    context = (
        "You are an SRE / incident-management assistant embedded in an incident tool.\n"
        "You DO have access to the current incident details below, and to a list called "
        "\"similar incidents\" that contains past incidents selected by the system.\n"
        "Never say that you don't have access to the incident system or to past incidents.\n"
        "\n"
        "If the user asks about similar past incidents:\n"
        "- If the similar incidents list is non-empty, explicitly mention the most relevant ones\n"
        "  and explain what can be learned from them (root cause, mitigation, severity, status).\n"
        "- If the similar incidents list is empty, say clearly that there are no similar incidents\n"
        "  in the provided list.\n"
        "\n"
        "Always answer in English. Be concise and action-oriented: focus on diagnosis hints\n"
        "and concrete next steps.\n"
        "\n"
        "Current incident:\n"
        f"- ID: {inc.id}\n"
        f"- Title: {inc.title}\n"
        f"- Status: {inc.status}\n"
        f"- Severity: {inc.severity}\n"
        f"- Description: {inc.description or '-'}\n"
    )

    if similar_lines:
        context += "\nSimilar incidents:\n" + "\n".join(similar_lines)
    else:
        context += "\nSimilar incidents: (none provided by the system)\n"

    # On construit la liste de messages pour OpenAI
    messages = [{"role": "system", "content": context}]
    for m in req.messages:
        role = "assistant" if m.role == "assistant" else "user"
        messages.append({"role": role, "content": m.content})

    resp = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=messages,
        temperature=0.4,
    )
    reply = (resp.choices[0].message.content or "").strip()
    return reply or "I couldn't generate a reply this time, please try again."

# ==========================
#  /incident-suggest helpers
# ==========================

def basic_incident_suggest(title: str, description: str) -> IncidentSuggestResponse:
    text = f"{title} {description}".strip()
    sev = guess_severity(text)
    tags = extract_tags(text)
    summary = build_basic_summary(title, description)
    suggested_title = (title or "").strip() or "Incident: investigation started"
    impact = (
        "Preliminary heuristic assessment of the incident impact. "
        "Further investigation is required to confirm scope and severity."
    )
    actions = [
        "Check logs, metrics and alerts around the suspected incident time.",
        "Confirm which users, services or regions are affected.",
        "Review recent deployments or configuration changes.",
    ]

    return IncidentSuggestResponse(
        summary=summary,
        suggestedTitle=suggested_title,
        impactSummary=impact,
        actionItems=actions,
        severityProposed=sev,
        statusProposed="OPEN",
        tags=tags,
        confidence=0.55,
    )


def llm_incident_suggest(title: str, description: str) -> IncidentSuggestResponse:
    if not openai_client:
        return basic_incident_suggest(title, description)

    prompt = (
        "You are an SRE assistant. Given an incident title and description, "
        "propose a better title, a short impact summary, and concrete next actions.\n\n"
        "Return ONLY valid JSON with this exact structure (no markdown):\n"
        '{\n'
        '  "summary": string,\n'
        '  "suggestedTitle": string,\n'
        '  "impactSummary": string,\n'
        '  "actionItems": [string, ...],\n'
        '  "severityProposed": string,  // SEV1..SEV5\n'
        '  "statusProposed": string,\n'
        '  "tags": [string, ...],\n'
        '  "confidence": number  // 0..1\n'
        "}\n\n"
        f"Title: {title or '-'}\n"
        f"Description: {description or '-'}\n"
    )

    resp = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You answer strictly in JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )
    content = (resp.choices[0].message.content or "").strip()

    fallback = basic_incident_suggest(title, description)

    try:
        data = json.loads(content)
    except Exception:
        # try to extract JSON from inside markdown / extra text
        try:
            start = content.index("{")
            end = content.rindex("}") + 1
            data = json.loads(content[start:end])
        except Exception:
            return fallback

    return IncidentSuggestResponse(
        summary=data.get("summary") or fallback.summary,
        suggestedTitle=data.get("suggestedTitle") or fallback.suggestedTitle,
        impactSummary=data.get("impactSummary") or fallback.impactSummary,
        actionItems=data.get("actionItems") or fallback.actionItems,
        severityProposed=data.get("severityProposed") or fallback.severityProposed,
        statusProposed=data.get("statusProposed") or fallback.statusProposed,
        tags=data.get("tags") or fallback.tags,
        confidence=float(data.get("confidence") or fallback.confidence),
    )


# ==========================
#  Global assistant helpers
# ==========================

def build_incidents_context(incidents: Optional[List[AssistantIncident]]) -> str:
    """
    Construit un contexte texte avec la *liste complète* des incidents.
    Chaque ligne = 1 incident avec son id, son titre, sa sévérité, son statut et sa date.
    L'IA doit utiliser uniquement ces infos comme "vérité terrain".
    """
    if not incidents:
        return ""

    lines: List[str] = []
    lines.append(
        "Here is the list of recent incidents. "
        "This list is the ONLY source of truth about incidents."
    )
    lines.append("Format: id | title | severity | status | createdAt")
    for inc in incidents:
        lines.append(
            f"- {inc.id} | {inc.title} | "
            f"severity={inc.severity or 'UNKNOWN'} | "
            f"status={inc.status or 'UNKNOWN'} | "
            f"createdAt={inc.createdAt or '-'}"
        )

    return "\n".join(lines)

# =========
#  Endpoints
# =========

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai", "provider": AI_PROVIDER}


@app.post("/incident-chat", response_model=IncidentChatResponse)
async def incident_chat(req: IncidentChatRequest):
    if AI_PROVIDER == "openai" and openai_client:
        reply = llm_incident_chat(req)
    else:
        reply = basic_incident_chat_reply(req)
    return IncidentChatResponse(reply=reply)


@app.post("/incident-suggest", response_model=IncidentSuggestResponse)
@app.post("/incidents/suggest", response_model=IncidentSuggestResponse)
async def incident_suggest(req: IncidentSuggestRequest):
    title = (req.title or "").strip()
    description = (req.description or "").strip()

    if AI_PROVIDER == "openai" and openai_client:
        return llm_incident_suggest(title, description)
    else:
        return basic_incident_suggest(title, description)


@app.post("/assistant-query", response_model=AssistantQueryResponse)
@app.post("/assistant/query", response_model=AssistantQueryResponse)
async def assistant_query(req: AssistantQueryRequest):
    """
    Global assistant = behaves like ChatGPT,
    mais pour les questions sur les incidents il doit utiliser
    uniquement la liste d'incidents fournie.
    """
    if AI_PROVIDER == "openai" and openai_client:
        ctx = build_incidents_context(req.incidents)

        system_prompt = (
            "You are a helpful AI assistant embedded in an incident management product.\n"
            "The system gives you a list of incidents (id, title, severity, status, createdAt).\n"
            "THIS LIST IS THE GROUND TRUTH about incidents.\n"
            "\n"
            "When the user asks questions about incidents (for example:\n"
            "'Which SEV1 incidents happened this week?', 'How many SEV2 incidents last month?',\n"
            "etc.), you MUST answer ONLY using this list. Do not invent incidents, titles,\n"
            "severities or dates. If the information is not present or is ambiguous, clearly say\n"
            "that you don't know based on the available data.\n"
            "\n"
            "If the question is not about incidents at all (small talk, coding, etc.), you can\n"
            "answer normally, but still do not invent new incidents.\n"
            "Always answer in the same language as the user."
        )

        if ctx:
            system_prompt += "\n\nIncident list:\n" + ctx

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.question},
        ]

        try:
            resp = openai_client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                temperature=0.4,
            )
            reply = (resp.choices[0].message.content or "").strip()
            if not reply:
                reply = (
                    "I couldn't generate a reply this time. "
                    "Please try asking your question again."
                )
            return AssistantQueryResponse(reply=reply)
        except Exception as e:
            print(f"[assistant-query] OpenAI error: {e}")

    # --- Fallback inchangé en dessous ---
    if not req.incidents:
        reply = (
            f"You asked: {req.question}\n\n"
            "I don't have any incident history yet, but I can still answer "
            "general questions."
        )
    else:
        ctx = build_incidents_context(req.incidents)
        reply = (
                f"You asked: {req.question}\n\n"
                "The language model is currently unavailable, but here is a quick "
                "summary of the incidents:\n\n" + ctx
        )

    return AssistantQueryResponse(reply=reply)
