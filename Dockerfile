FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Browser keys are inlined at build time. Empty values keep mock mode.
# Compose mounts .env.local as a secret so `docker compose up --build` picks it up
# without copying the file into an image layer.
ARG NEXT_PUBLIC_MAPBOX_TOKEN=
ARG NEXT_PUBLIC_OPENROUTER_API_KEY=
ARG NEXT_PUBLIC_FAL_API_KEY=
ARG NEXT_PUBLIC_TRIPO_API_KEY=
ARG NEXT_PUBLIC_MAPILLARY_TOKEN=
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_PUBLIC_OPENROUTER_API_KEY=$NEXT_PUBLIC_OPENROUTER_API_KEY \
    NEXT_PUBLIC_FAL_API_KEY=$NEXT_PUBLIC_FAL_API_KEY \
    NEXT_PUBLIC_TRIPO_API_KEY=$NEXT_PUBLIC_TRIPO_API_KEY \
    NEXT_PUBLIC_MAPILLARY_TOKEN=$NEXT_PUBLIC_MAPILLARY_TOKEN \
    NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=secret,id=envlocal,target=/tmp/.env.local \
    if [ -f /tmp/.env.local ]; then \
      while IFS= read -r line || [ -n "$line" ]; do \
        line=$(printf '%s' "$line" | tr -d '\r'); \
        case "$line" in ''|\#*) continue ;; esac; \
        key=${line%%=*}; \
        val=${line#*=}; \
        case "$val" in \
          \"*\") val=${val#\"}; val=${val%\"} ;; \
          \'*\') val=${val#\'}; val=${val%\'} ;; \
        esac; \
        export "$key=$val"; \
      done < /tmp/.env.local; \
    fi; \
    npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
