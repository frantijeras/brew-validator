# Despliegue en VPS (Docker + Caddy)

Guía para servir **brewidea** desde tu VPS (`46.225.80.127`) en
`https://brewidea.duckdns.org`, en lugar de Vercel.

La app sigue usando la misma base de datos (Neon) y el mismo bridge de OpenClaw
que ya corre en el VPS. Caddy se encarga del HTTPS automático.

## 0. Requisitos en el VPS

- Docker + Docker Compose (`docker compose version` para comprobar).
- Puertos **80** y **443** abiertos en el firewall (Caddy los usa para el
  tráfico web y para emitir el certificado). Los puertos internos 3000 y 9090
  NO se exponen a internet.
- DuckDNS: `brewidea` apuntando a `46.225.80.127` (ya hecho ✓).

Abrir puertos si usas ufw:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 1. Traer el código

```bash
git clone <repo> /opt/brewidea   # o git pull si ya está
cd /opt/brewidea
```

## 2. Variables de entorno

```bash
cp .env.production.example .env.production
nano .env.production
```

Rellena:

- `DATABASE_URL` — copia el valor exacto que tenías en Vercel (Neon).
- `NEXTAUTH_URL` — `https://brewidea.duckdns.org`.
- `NEXTAUTH_SECRET` — genera uno: `openssl rand -base64 32`.
- `CRON_SECRET` — genera otro igual; lo usarás en el crontab (paso 5).
- `BRIDGE_API_URL` — déjalo en `http://host.docker.internal:9090` (el compose
  ya enruta `host.docker.internal` al host donde vive el bridge).
- `BRIDGE_SECRET` / `OPENCODE_API_KEY` — los mismos que ya usabas, si aplican.

## 3. Levantar

```bash
docker compose up -d --build
```

Comprobaciones:

```bash
docker compose ps
docker compose logs -f caddy   # debe emitir el certificado de Let's Encrypt
docker compose logs -f app
```

La primera vez Caddy tarda unos segundos en obtener el certificado. Luego entra
en `https://brewidea.duckdns.org`.

## 4. Migraciones de Prisma

La base es la misma que en Vercel, así que el esquema ya está aplicado. Si en el
futuro cambia el esquema:

```bash
docker compose exec app npx prisma migrate deploy
```

## 5. Cron del reaper (sustituye al Vercel Cron)

En Vercel (plan Hobby) el reaper solo podía correr 1 vez al día. En el VPS puedes
volver a cada 5 minutos. Edita el crontab del VPS:

```bash
crontab -e
```

Añade (sustituye `TU_CRON_SECRET` por el valor de `.env.production`):

```cron
*/5 * * * * curl -fsS -H "Authorization: Bearer TU_CRON_SECRET" http://127.0.0.1:3000/api/cron/reap >/dev/null 2>&1
```

Llama a `127.0.0.1:3000` (la app publicada en localhost), así no depende de
Caddy ni del DNS.

## 6. Actualizar tras nuevos cambios

```bash
cd /opt/brewidea
git pull
docker compose up -d --build
```

## Notas

- `vercel.json` se puede dejar o borrar; aquí no se usa. El cron ahora lo lleva
  el crontab del VPS.
- Si prefieres no usar Caddy de momento y solo probar, puedes acceder por
  `http://46.225.80.127:3000` tras cambiar el `ports` del servicio `app` a
  `"3000:3000"` — pero NextAuth necesita HTTPS para las cookies seguras, así que
  el modo recomendado es con Caddy + dominio.
```
