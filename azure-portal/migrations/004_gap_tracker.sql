-- Distribution gap tracker (first client: Sir Fruit). The client sends one workbook with a weekly gap matrix per
-- banner; each cell is a store x product status. Uploads replace whole (client, banner, week) snapshots.
CREATE TABLE dbo.gap_uploads (
  id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
  client nvarchar(60) NOT NULL,
  file_name nvarchar(260) NOT NULL,
  sha256 char(64) NOT NULL,
  uploaded_at datetime2 NOT NULL DEFAULT sysutcdatetime(),
  uploaded_by nvarchar(320) NOT NULL,
  summary nvarchar(max) NOT NULL CONSTRAINT ck_gap_uploads_summary_json CHECK (ISJSON(summary) = 1)
);
CREATE INDEX ix_gap_uploads_client ON dbo.gap_uploads (client, uploaded_at DESC);
GO
-- status: N = No gap, O = Opportunity, L = Lost. Blank cells (product not ranged in that store) are not stored.
-- store_key is the store name lower-cased with spaces collapsed, so a store is followed across weeks even when the
-- client's spelling of capitals or spacing changes.
CREATE TABLE dbo.gap_observations (
  client nvarchar(60) NOT NULL,
  banner nvarchar(60) NOT NULL,
  week date NOT NULL,
  store_key nvarchar(200) NOT NULL,
  store nvarchar(200) NOT NULL,
  region nvarchar(80) NULL,
  product nvarchar(200) NOT NULL,
  status char(1) NOT NULL CONSTRAINT ck_gap_status CHECK (status IN ('N', 'O', 'L')),
  upload_id int NOT NULL CONSTRAINT fk_gap_upload REFERENCES dbo.gap_uploads (id),
  CONSTRAINT pk_gap_observations PRIMARY KEY (client, banner, week, store_key, product)
);
CREATE INDEX ix_gap_observations_week ON dbo.gap_observations (client, banner, week) INCLUDE (status);
