-- Firestore -> SQL sync bookkeeping (plan stage B).
-- sync_runs: one row per sync job run, for monitoring in the portal.
CREATE TABLE dbo.sync_runs (
  id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
  mode nvarchar(20) NOT NULL,
  started_at datetime2 NOT NULL DEFAULT sysutcdatetime(),
  finished_at datetime2 NULL,
  status nvarchar(20) NOT NULL DEFAULT 'running',
  documents_read int NOT NULL DEFAULT 0,
  documents_written int NOT NULL DEFAULT 0,
  documents_deleted int NOT NULL DEFAULT 0,
  detail nvarchar(max) NULL CONSTRAINT ck_sync_runs_detail_json CHECK (detail IS NULL OR ISJSON(detail) = 1),
  error nvarchar(2000) NULL
);
CREATE INDEX ix_sync_runs_started ON dbo.sync_runs (started_at DESC);
GO
-- sync_checkpoints: per collection, the highest timestamp copied by incremental runs and the last full pass.
CREATE TABLE dbo.sync_checkpoints (
  collection nvarchar(200) NOT NULL PRIMARY KEY,
  field nvarchar(100) NULL,
  last_value nvarchar(64) NULL,
  last_full_at datetime2 NULL,
  document_count int NULL,
  updated_at datetime2 NOT NULL DEFAULT sysutcdatetime()
);
