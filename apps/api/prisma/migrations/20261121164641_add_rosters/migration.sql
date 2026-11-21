-- CreateEnum
CREATE TYPE "RosterStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('WORKING', 'WEEKOFF', 'LEAVE', 'COMP_OFF', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "rosters" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "RosterStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_entries" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "EntryStatus" NOT NULL,
    "source" "EntrySource" NOT NULL DEFAULT 'AUTO',

    CONSTRAINT "roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rosters_year_month_key" ON "rosters"("year", "month");

-- CreateIndex
CREATE INDEX "roster_entries_rosterId_idx" ON "roster_entries"("rosterId");

-- CreateIndex
CREATE UNIQUE INDEX "roster_entries_rosterId_employeeId_date_key" ON "roster_entries"("rosterId", "employeeId", "date");

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
