-- Multi-tenant: cada Idea pertenece a un User. Project hereda el dueño vía idea.
-- Columna nullable para no romper filas existentes; se rellenan abajo (backfill).

ALTER TABLE "Idea" ADD COLUMN "userId" TEXT;

-- Backfill: asignar todas las ideas existentes al primer admin; si no hay
-- admin, al usuario más antiguo. Single-tenant hoy (un único usuario real).
UPDATE "Idea"
SET "userId" = (
  SELECT "id" FROM "User"
  ORDER BY "isAdmin" DESC, "createdAt" ASC
  LIMIT 1
)
WHERE "userId" IS NULL;

CREATE INDEX "Idea_userId_idx" ON "Idea"("userId");

ALTER TABLE "Idea"
  ADD CONSTRAINT "Idea_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
