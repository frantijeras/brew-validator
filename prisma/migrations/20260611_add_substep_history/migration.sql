-- AlterTable
-- Almacena el histórico de cada subfase confirmada (naming/voice/visual) con su
-- elección y artefacto, para que el Brand Book consolide las opciones elegidas
-- en cada subfase sin que una sobrescriba a la anterior.
ALTER TABLE "ProjectPhase" ADD COLUMN "subStepHistory" JSONB;
