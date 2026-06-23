# Despliegue en VPS (Docker + Caddy nativo)

Guía para servir **brewidea** desde el VPS (`46.225.80.127`) en
`https://brewidea.duckdns.org`, en lugar de Vercel/Neon.

## Arquitectura

- **app** (Next.js, contenedor Docker) publicada en `127.0.0.1:3000`.
- **db** (PostgreSQL 16, contenedor Docker) en `127.0.0.1:5432`, datos en el
  volumen `pgdata`. Sustituye a Neon (sin cuotas, latencia mínima).
- **Caddy NATIVO** del host (systemd, no Docker) escucha en `:80`/`:443` y hace
  de reverse proxy a `127.0.0.1:3000` con HTTPS automático (Let's Encrypt).
  Su config está en `/etc/caddy/Caddyfile`.
- **bridge** de OpenClaw sigue en el host (`127.0.0.1:9090`); el contenedor lo
  alcanza vía `host.docker.internal`.

> El servicio `caddy` NO está en el compose a propósito: el host ya tiene Caddy
> nativo en 80/443. Levantar otro chocaría de puertos.

## 0. Requisitos en el VPS

- Docker + Docker Compose.
- Puertos **80** y **443** abiertos (Caddy). Los internos 3000/5432/9090 NO se
  exponen a internet.
- DuckDNS: `brewidea` → `46.225.80.127` (✓).

## 1. Código

```bash
git clone <repo> /root/proyectos/brew-validator   # o git pull si ya está
cd /root/proyectos/brew-validator
```

## 2. Variables de entorno

`.env` (lo lee docker compose para interpolar) — contraseña de Postgres:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" >> .env
```

`.env.production` (lo lee la app) a partir del ejemplo:

```bash
cp .env.production.example .env.production
nano .env.production
```

- `DATABASE_URL` → `postgresql://brewidea:<POSTGRES_PASSWORD>@db:5432/brewidea?connect_timeout=15`
  (mismo valor que pusiste en `.env`).
- `NEXTAUTH_URL` → `https://brewidea.duckdns.org`.
- `NEXTAUTH_SECRET` → `openssl rand -base64 32`.
- `CRON_SECRET` → otro `openssl rand`; se usa en el crontab (paso 6).
- `BRIDGE_API_URL` → `http://host.docker.internal:9090`.
- `BRIDGE_SECRET` / `OPENCODE_API_KEY` → los que use el bridge.

## 3. Levantar

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

## 4. Esquema y datos (solo la primera vez / BD nueva)

Las migraciones de `prisma/migrations` tienen un problema de orden alfabético
en una BD nueva, así que para una BD limpia se crea el esquema con `db push`:

```bash
export DATABASE_URL="postgresql://brewidea:<POSTGRES_PASSWORD>@localhost:5432/brewidea"
node_modules/.bin/prisma db push --force-reset --skip-generate   # ⚠️ borra datos
node_modules/.bin/tsx prisma/seed.ts                              # usuario admin + ideas
```

> Nota: desde el host se usa `localhost:5432`; dentro del contenedor es `db:5432`.

## 5. Caddy nativo (HTTPS)

Añade el bloque del sitio a `/etc/caddy/Caddyfile` (ver `Caddyfile` del repo)
y recarga:

```bash
cat Caddyfile >> /etc/caddy/Caddyfile   # o pega el bloque a mano
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

## 6. Cron del reaper (sustituye al Vercel Cron)

```bash
crontab -e
```

```cron
*/5 * * * * curl -fsS -H "Authorization: Bearer TU_CRON_SECRET" http://127.0.0.1:3000/api/cron/reap >/dev/null 2>&1
```

## 7. Actualizar tras nuevos cambios

```bash
cd /root/proyectos/brew-validator
git pull
docker compose up -d --build app
```
