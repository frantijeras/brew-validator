-- AlterTable
ALTER TABLE "Project" ADD COLUMN "handoffReady" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "generatedSkills" JSONB;
