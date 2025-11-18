-- DropIndex
DROP INDEX "incident_embedding_hnsw";

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "description" TEXT;
