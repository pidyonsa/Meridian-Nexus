-- Firestore document paths can be up to 1,500 bytes, longer than an index key allows. Key rows on a SHA-256 hash of
-- the full path instead, so no path is ever truncated and lookups stay a fixed 32 bytes.
ALTER TABLE dbo.documents DROP CONSTRAINT pk_documents;
ALTER TABLE dbo.documents ALTER COLUMN id nvarchar(1500) NOT NULL;
GO
ALTER TABLE dbo.documents ADD id_hash AS CAST(HASHBYTES('SHA2_256', id) AS binary(32)) PERSISTED NOT NULL;
GO
ALTER TABLE dbo.documents ADD CONSTRAINT pk_documents PRIMARY KEY (collection, id_hash);
