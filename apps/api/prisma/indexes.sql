-- Index simples
CREATE INDEX IF NOT EXISTS "Incident_createdAt_idx" ON "Incident" ("createdAt");
CREATE INDEX IF NOT EXISTS "Incident_status_idx"    ON "Incident" ("status");
CREATE INDEX IF NOT EXISTS "Incident_severity_idx"  ON "Incident" ("severity");

-- Index composés utiles
CREATE INDEX IF NOT EXISTS "Incident_status_createdAt_idx"   ON "Incident" ("status","createdAt");
CREATE INDEX IF NOT EXISTS "Incident_severity_createdAt_idx" ON "Incident" ("severity","createdAt");