FROM node:20-alpine

# SWC / Next sur Alpine
RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Fichiers racine du monorepo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Toutes les apps (dont apps/web)
COPY apps ./apps

# Install deps (workspace complète)
RUN pnpm install --frozen-lockfile --prod=false

# On se place dans le dossier de l'app web
WORKDIR /app/apps/web

# Build Next
RUN pnpm run build

EXPOSE 3000

# Démarrage en mode prod
CMD ["pnpm", "run", "start"]
