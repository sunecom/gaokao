# ===== Build Stage =====
FROM node:22-bookworm-slim AS builder

RUN apt-get update -qq && apt-get install -y -qq python3 sqlite3 2>&1 | tail -3

WORKDIR /app
COPY apps/web/package.json ./
RUN npm install --production=false

COPY apps/web/ .
RUN npm run build

# ===== Production Stage =====
FROM node:22-bookworm-slim AS runner

RUN apt-get update -qq && apt-get install -y -qq python3 sqlite3 2>&1 | tail -3

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --chown=nextjs:nodejs data/gaokao.db ./data/
COPY --chown=nextjs:nodejs data/decision_tree.json ./data/
COPY --chown=nextjs:nodejs data/career_test.json ./data/
COPY --chown=nextjs:nodejs data/rank_estimate_config.json ./data/
COPY --chown=nextjs:nodejs data/school_extra.json ./data/
COPY --chown=nextjs:nodejs data/rank_tables/ ./data/rank_tables/

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
