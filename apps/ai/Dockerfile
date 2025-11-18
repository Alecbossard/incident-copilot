FROM python:3.12-slim

WORKDIR /app

# Dépendances pour FastAPI + LLMs
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" pydantic openai google-generativeai

# On copie main.py depuis la racine du repo (contexte = ../.. dans docker-compose)
COPY apps/ai/main.py ./main.py

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
