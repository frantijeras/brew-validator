-- AlterTable
-- Persiste las respuestas del quiz que el usuario ya envió, para que un fallo
-- del informe (mode "report") posterior al quiz pueda REINTENTAR solo ese paso
-- sin obligar a re-responder las preguntas desde cero.
ALTER TABLE "ProjectPhase" ADD COLUMN "answers" JSONB;
