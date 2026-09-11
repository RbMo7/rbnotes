-- CreateTable
CREATE TABLE "anonymous_devices" (
    "id" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anonymous_devices_pkey" PRIMARY KEY ("id")
);
