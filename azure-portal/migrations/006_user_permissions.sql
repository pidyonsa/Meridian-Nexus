-- Nexus permissions managed in Admin › Users (26 October 2026), as the Firebase-era Admin did with adminUsers
-- permissions. Microsoft Entra signs people in and the Entra role Nexus.Admin stays the permanent administrator;
-- everything else a person may open is recorded here, by sign-in email, so it can be set before their first visit.
-- sections: JSON array of section ids (server/permissions/catalogue.cjs). disabled: no access to Nexus at all.
CREATE TABLE dbo.user_permissions (
  email nvarchar(320) NOT NULL PRIMARY KEY,
  display_name nvarchar(200) NULL,
  is_admin bit NOT NULL DEFAULT 0,
  disabled bit NOT NULL DEFAULT 0,
  sections nvarchar(max) NOT NULL DEFAULT '[]' CONSTRAINT ck_user_permissions_sections_json CHECK (ISJSON(sections) = 1),
  note nvarchar(300) NULL,
  created_at datetime2 NOT NULL DEFAULT sysutcdatetime(),
  created_by nvarchar(320) NOT NULL,
  updated_at datetime2 NOT NULL DEFAULT sysutcdatetime(),
  updated_by nvarchar(320) NOT NULL
);
