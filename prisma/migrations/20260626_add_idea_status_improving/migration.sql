-- AlterEnum
-- Nuevo estado IMPROVING para el flujo "Mejorar idea" (agente idea-improver):
-- mientras el bridge genera el informe de mejora, la idea queda "ocupada" y se
-- bloquean las mutaciones de contenido (ver lib/idea-state.ts).
ALTER TYPE "IdeaStatus" ADD VALUE IF NOT EXISTS 'IMPROVING';
