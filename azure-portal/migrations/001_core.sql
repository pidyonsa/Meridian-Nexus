-- Core tables for Nexus on Azure.
-- users: one row per Meridian staff member, keyed by Entra object id. Roles come from Entra app roles at sign-in;
--        this table holds profile, Nexus-specific access (divisions, managers) and activity.
CREATE TABLE dbo.users (
  id uniqueidentifier NOT NULL PRIMARY KEY,
  email nvarchar(320) NOT NULL,
  display_name nvarchar(200) NOT NULL,
  is_admin bit NOT NULL DEFAULT 0,
  active bit NOT NULL DEFAULT 1,
  profile nvarchar(max) NULL CONSTRAINT ck_users_profile_json CHECK (profile IS NULL OR ISJSON(profile) = 1),
  firebase_uid nvarchar(128) NULL,
  created_at datetime2 NOT NULL DEFAULT sysutcdatetime(),
  last_seen_at datetime2 NULL
);
CREATE UNIQUE INDEX ux_users_email ON dbo.users (email);
CREATE UNIQUE INDEX ux_users_firebase_uid ON dbo.users (firebase_uid) WHERE firebase_uid IS NOT NULL;
GO
-- audit_log: every administrative change and sign-in, append-only.
CREATE TABLE dbo.audit_log (
  id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
  at datetime2 NOT NULL DEFAULT sysutcdatetime(),
  actor_id uniqueidentifier NULL,
  actor_email nvarchar(320) NULL,
  action nvarchar(100) NOT NULL,
  target nvarchar(400) NULL,
  detail nvarchar(max) NULL CONSTRAINT ck_audit_detail_json CHECK (detail IS NULL OR ISJSON(detail) = 1),
  request_id nvarchar(64) NULL
);
CREATE INDEX ix_audit_at ON dbo.audit_log (at DESC);
CREATE INDEX ix_audit_actor ON dbo.audit_log (actor_id, at DESC);
GO
-- documents: Firestore documents copied as JSON during the migration (plan stage B), one row per document.
-- Features read from here until they get their own tables.
CREATE TABLE dbo.documents (
  collection nvarchar(200) NOT NULL,
  id nvarchar(400) NOT NULL,
  data nvarchar(max) NOT NULL CONSTRAINT ck_documents_json CHECK (ISJSON(data) = 1),
  source_update_time datetime2 NULL,
  synced_at datetime2 NOT NULL DEFAULT sysutcdatetime(),
  CONSTRAINT pk_documents PRIMARY KEY (collection, id)
);
CREATE INDEX ix_documents_source_update ON dbo.documents (collection, source_update_time);
GO
-- app_settings: small key/value configuration that admins change in the portal.
CREATE TABLE dbo.app_settings (
  [key] nvarchar(200) NOT NULL PRIMARY KEY,
  value nvarchar(max) NOT NULL CONSTRAINT ck_settings_json CHECK (ISJSON(value) = 1),
  updated_at datetime2 NOT NULL DEFAULT sysutcdatetime(),
  updated_by nvarchar(320) NULL
);
