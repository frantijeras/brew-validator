# syntax=docker/dockerfile:1

# ---------- Dependencias ----------
FROM node:20-slim AS deps
WORKDIR /app
# OpenSSL es necesario para el motor de Prisma en Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- Build ----------
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Si alguna ruta hiciera fetch a la BD durante el build, descomenta y pasa
# --build-arg DATABASE_URL=... ; las rutas dinámicas (force-dynamic) no lo necesitan.
# ARG DATABASE_URL
# ENV DATABASE_URL=$DATABASE_URL
RUN npm run build

# ---------- Runtime ----------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    # Neon resuelve a IPv6 + IPv4, pero la red bridge de Docker es solo IPv4.
    # glibc prefiere IPv6 por defecto, así que Prisma intenta la AAAA y falla
    # ("Can't reach database server"). Forzamos preferencia IPv4 vía gai.conf.
    && printf 'precedence ::ffff:0:0/96  100\n' > /etc/gai.conf

# Salida standalone de Next (incluye un node_modules mínimo).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Motor de Prisma generado (por si el tracing de Next no lo arrastra).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
