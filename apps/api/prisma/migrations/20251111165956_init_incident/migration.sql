-- Ensure pgvector is present
CREATE EXTENSION IF NOT EXISTS vector;

-- If the column does not exist, create it directly at 1536
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Incident' AND column_name = 'embedding'
  ) THEN
ALTER TABLE "Incident" ADD COLUMN "embedding" vector(1536);
ELSE
    -- Column exists: change its dimension to 1536
ALTER TABLE "Incident" ALTER COLUMN "embedding" TYPE vector(1536);
END IF;
END$$;

-- Index (recreate if needed) — name is stable if it already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'incident_embedding_hnsw'
  ) THEN
CREATE INDEX incident_embedding_hnsw
    ON "Incident" USING hnsw (embedding vector_cosine_ops);
END IF;
END$$;
