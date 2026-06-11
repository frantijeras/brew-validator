-- AlterTable: schemaVersion para evolución del esquema esperado (info técnica 3.3)
ALTER TABLE "BridgeLog" ADD COLUMN "schemaVersion" TEXT;

-- CreateTable: Notification (feedback capa 4 — alertas críticas in-app)
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "phaseId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'error',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "errorType" TEXT,
    "actionUrl" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
