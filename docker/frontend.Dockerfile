# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY frontend .

# NEXT_PUBLIC_* variables are inlined into the client bundle at BUILD time,
# not read at container runtime — so this must be a build ARG, passed in via
# docker-compose.yml's `build.args`, not a runtime `environment:` entry.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# .next/standalone contains a self-sufficient server.js plus the trimmed
# node_modules subset Next.js determined the app actually needs.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
