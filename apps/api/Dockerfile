# --- base ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# --- deps (workspace complète + prisma generate) ---
FROM base AS deps
WORKDIR /app

# 1) on copie les fichiers de la racine du monorepo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# 2) on copie toutes les apps (dont apps/api)
COPY apps ./apps

# 3) install pnpm (toutes les deps + devDeps)
RUN pnpm install --frozen-lockfile --prod=false

# 4) on génère le client Prisma POUR l'API dans ce stage
WORKDIR /app/apps/api
RUN pnpm exec prisma generate

# on revient à la racine pour le stage suivant
WORKDIR /app

# --- build (Nest build uniquement) ---
FROM deps AS build
WORKDIR /app/apps/api
RUN pnpm exec nest build

# --- runtime ---
FROM node:20-alpine AS runtime
RUN apk add --no-cache wget
ENV NODE_ENV=production

# Très important : on se place dans le dossier de l'API
WORKDIR /app/apps/api

# 1) store pnpm global (node_modules/.pnpm, etc.)
COPY --from=deps /app/node_modules /app/node_modules

# 2) node_modules du package api (là où est @prisma/client généré)
COPY --from=deps /app/apps/api/node_modules ./node_modules

# 3) package.json du package api
COPY --from=deps /app/apps/api/package.json ./package.json

# 4) code compilé + prisma
COPY --from=build /app/apps/api/dist ./dist
COPY --from=deps  /app/apps/api/prisma ./prisma

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --retries=10 CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "dist/main.js"]
