-- Gap tracker clients. Each client's dashboard uses the status colours from its own workbook (captured at upload).
CREATE TABLE dbo.gap_clients (
  id nvarchar(60) NOT NULL PRIMARY KEY,
  label nvarchar(120) NOT NULL,
  colors nvarchar(max) NULL CONSTRAINT ck_gap_clients_colors_json CHECK (colors IS NULL OR ISJSON(colors) = 1),
  active bit NOT NULL DEFAULT 1,
  created_at datetime2 NOT NULL DEFAULT sysutcdatetime(),
  created_by nvarchar(320) NOT NULL
);
GO
INSERT dbo.gap_clients (id, label, colors, created_by)
VALUES ('sir-fruit', 'Sir Fruit', N'{"N":"#00A650","O":"#FFC000","L":"#C00000","header":"#F1F5F9"}', 'migration 005');
GO
ALTER TABLE dbo.gap_observations ADD CONSTRAINT fk_gap_client FOREIGN KEY (client) REFERENCES dbo.gap_clients (id);
