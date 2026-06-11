-- CreateTable
CREATE TABLE "BridgeLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'error',
    "jobId" TEXT,
    "ideaId" TEXT,
    "projectId" TEXT,
    "phaseId" TEXT,
    "agentName" TEXT,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "httpStatus" INTEGER,
    "retryCount" INTEGER,
    "resolutionAction" TEXT,
    "model" TEXT,
    "provider" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "latencyMs" INTEGER,

    CONSTRAINT "BridgeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BridgeLog_createdAt_idx" ON "BridgeLog"("createdAt");

-- CreateIndex
CREATE INDEX "BridgeLog_projectId_idx" ON "BridgeLog"("projectId");

-- CreateIndex
CREATE INDEX "BridgeLog_jobId_idx" ON "BridgeLog"("jobId");
