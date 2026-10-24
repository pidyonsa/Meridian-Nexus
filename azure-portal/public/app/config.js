// Per-site settings for the Nexus workspace. This file is replaced when the workspace is built into another site
// (azure-field-dashboards/scripts/build.cjs writes the nexus.meridiangroup.co.za version).
export const CONFIG = {
  // Tools that work on this site.
  built: ['admin-overview', 'admin-users', 'gaps', 'gap-upload'],
  // Where tools that have not moved yet still run.
  currentNexus: 'https://meridain-nexus.web.app/',
  // true: open those tools directly (same site); false: show a "moving" page with a link first.
  directLinks: false,
  // Tools served as separate full pages on this site (not inside the workspace).
  pageTools: []
};
