# Local CODES Folder Study

Source folder reviewed: `C:\Users\PC\Downloads\CODES`

Date reviewed: 2026-09-02

## Boundary

This folder is treated as reference material only. Nexus should not execute scripts from this folder, write into these folders, or copy authentication/session handling directly into production.

Safe use:

- Read files and catalogue module structure.
- Copy UI patterns, dashboard layout ideas, and data-contract concepts.
- Rebuild useful workflows inside Nexus using Firebase Auth, Firestore, Cloud Functions, and the existing Nexus permissions model.
- Store integration metadata and migration readiness in Firestore.

Unsafe use:

- Running legacy scripts directly from `Downloads\CODES`.
- Reusing local browser profiles, scheduled tasks, or laptop-specific OneDrive paths.
- Copying MSAL, Azure app-auth, SharePoint write helpers, or hardcoded auth settings without review.
- Letting Nexus write back into the legacy source folders during this phase.

## Modules Found

### Stockfix-main

Main path: `C:\Users\PC\Downloads\CODES\Stockfix-main\Stockfix-main`

Purpose: Full StockFix retail inventory action and feedback tool.

Technology:

- React/TypeScript frontend.
- Vite build.
- Express/Node backend.
- PostgreSQL with Drizzle ORM.
- Excel import through `xlsx`.
- Image/file uploads through `multer`.
- SharePoint/Graph helpers through Azure app credentials.

Useful Nexus material:

- StockFix task model and feedback workflow.
- Store, rep, manager and client dashboard layouts.
- Excel import mapping concepts.
- Mobile-first field task UI.
- Inventory dashboard patterns.

Do not copy directly:

- `server/sharepoint-appauth.ts`
- `server/onedrive.ts`
- Replit object storage code.
- Postgres session/auth assumptions.
- Any SharePoint write/export endpoint until we intentionally migrate it.

Recommended Nexus approach:

- Rebuild StockFix as a Nexus module using Firestore collections for tasks, task feedback, store summaries, attachments and audit logs.
- Use Firebase Storage or existing approved SharePoint delivery only after a write contract is agreed.
- Keep the old app as a UI and workflow reference only.

### stockfix-dashboard-main

Main path: `C:\Users\PC\Downloads\CODES\stockfix-dashboard-main\stockfix-dashboard-main`

Purpose: Standalone StockFix field performance dashboard.

Useful Nexus material:

- Dashboard sections: task breakdown, reason code analysis, classification summary, leaderboards, heatmaps, region performance, impact summary and follow-ups.
- Good candidate for Nexus dashboard design ideas.

Recommended Nexus approach:

- Recreate the analytics panels against Firestore/Cloud Function aggregates.
- Do not depend on direct SharePoint browser auth from the old page.

### Meridian-Call-Cycle-Coverage-main

Main path: `C:\Users\PC\Downloads\CODES\Meridian-Call-Cycle-Coverage-main\Meridian-Call-Cycle-Coverage-main`

Duplicate path also exists: `Meridian-Call-Cycle-Coverage-main (1)`

Purpose: Call cycle coverage dashboard for reps and merchandisers.

Technology:

- Static HTML/JS dashboard.
- MSAL browser auth.
- SharePoint/Graph reads.
- Python local server for live local data.
- Python hierarchy scripts.

Important files:

- `index.html`
- `support.js`
- `msal-auth.js`
- `hierarchy.json`
- `scripts/live_data_server.py`
- `scripts/build_hierarchy.py`
- `pg/index.html`

Useful Nexus material:

- Rep vs merchandiser split.
- Resource hierarchy logic.
- Week/day call cycle data shapes.
- Store level export expectations.

Do not copy directly:

- Local server assumptions.
- Direct browser MSAL auth flow.
- Local OneDrive path reads.
- Scripts that write `hierarchy.json` in place.

Recommended Nexus approach:

- Store call cycle master rows in Firestore or a managed import collection.
- Store hierarchy as a normalized Firestore collection.
- Rebuild the dashboard as a Nexus page using Nexus auth and admin visibility rules.

### PG-Rep-Attendance-main

Main path: `C:\Users\PC\Downloads\CODES\PG-Rep-Attendance-main\PG-Rep-Attendance-main`

Purpose: P&G Rep Attendance dashboard and monthly extraction helper.

Technology:

- Static dashboard.
- Python workbook extractor.
- Data files such as `attendance-data-aug26.js`.

Important files:

- `index.html`
- `P&G Rep Attendance Dashboard.dc.html`
- `extract_month.py`
- `HOW TO UPDATE THIS DASHBOARD.md`

Useful Nexus material:

- Attendance workbook field mapping.
- Weekly target/actual rollups.
- Rep aggregation.
- Daily and monthly attendance dashboard ideas.

Recommended Nexus approach:

- Keep using Nexus Cloud Functions to read/write approved workbooks.
- Use the extraction logic as a reference only.
- Avoid the old GitHub Pages publish process.

### Sales-Insights-master

Main path: `C:\Users\PC\Downloads\CODES\Sales-Insights-master\Sales-Insights-master`

Duplicate path also exists: `Sales-Insights-master (1)`

Purpose: Sales Insights dashboard backed by exported mock data.

Technology:

- Static dashboard.
- JSON mock-data files.
- Python script exporting from DuckDB.

Important files:

- `index.html`
- `Sales Insights Dashboard.dc.html`
- `scripts/export_mock_data.py`
- `mock-data/*.json`

Useful Nexus material:

- KPI card shapes.
- Region, banner, brand, category and product breakdowns.
- Store performance and insights models.
- DuckDB query output contracts.

Recommended Nexus approach:

- Use the JSON mock-data shapes as target API contracts for Nexus dashboards.
- Source live sales data from approved Geo Rep API/report imports once available.
- Avoid local DuckDB path dependencies in production.

### Nexus-Hub--main

Main path: `C:\Users\PC\Downloads\CODES\Nexus-Hub--main\Nexus-Hub--main`

Purpose: Standalone executive summary / platform hub.

Useful Nexus material:

- Executive overview design.
- Module navigation concepts.
- Management-facing language and slides.

Recommended Nexus approach:

- Reuse only the page structure and content ideas.
- Do not embed the bundled page directly into the Nexus portal without cleaning it.

### Meridian-Nexus-main

Main path: `C:\Users\PC\Downloads\CODES\Meridian-Nexus-main\Meridian-Nexus-main`

Purpose: Older Nexus Connect notifications robot and portal integration.

Technology:

- Node.js Playwright robot.
- Windows scheduled task.
- SharePoint/Graph read from the portal.

Important files:

- `notifications.js`
- `scripts/local-georep-robot.mjs`
- `scripts/sync-georep-notifications.mjs`
- `handoff/HANDOFF.md`

Useful Nexus material:

- Notifications data shape.
- GeoRep content feed scraping logic.
- Handoff and troubleshooting notes.

Do not copy directly:

- Browser profile/session behavior.
- Local scheduled task XML.
- Machine-specific setup scripts.

Recommended Nexus approach:

- If notifications remain needed, rebuild the feed as a Nexus-controlled scheduled worker or approved API/import.
- Store notification items in Firestore.
- Keep image storage and access under Nexus-managed permissions.

### training-hub-main

Main path: `C:\Users\PC\Downloads\CODES\training-hub-main\training-hub-main`

Purpose: Training/Learning dashboard.

Technology:

- Static HTML/JS.
- MSAL browser auth.
- SharePoint/Graph reads.

Useful Nexus material:

- Learning performance dashboard UI.
- Module completion, region completion, manager leaderboard, learner leaderboard patterns.

Recommended Nexus approach:

- Rebuild HR/training reporting in Nexus using Geo Rep Open API learning/form data where available, plus Firestore reporting snapshots.

### Nexus-Image-Recognition-main

Main path: `C:\Users\PC\Downloads\CODES\Nexus-Image-Recognition-main\Nexus-Image-Recognition-main`

Purpose: Local image recognition starter for merchandising photos.

Technology:

- Python.
- YOLOv8 / Ultralytics.
- Streamlit.
- OpenCV.
- Local dataset and model files.

Useful Nexus material:

- Prototype path for image recognition / compliance checks.
- Privacy helpers for stripping EXIF and blurring faces.

Do not copy directly:

- Local model weights into production without review.
- Raw training images or labels into Firebase without confirming privacy and retention rules.

Recommended Nexus approach:

- Keep this local until a formal AI image workflow is agreed.
- Later, deploy as a separate controlled worker/service, not inside the main Firebase frontend.

## Firebase Preparation

Suggested Firestore collections for the integration-prep phase:

- `legacyModuleContracts/{moduleKey}`
- `legacyModuleInventory/{moduleKey}/files/{fileId}`
- `legacyModuleDesignReferences/{moduleKey}/screens/{screenId}`
- `legacyModuleDataContracts/{moduleKey}/contracts/{contractId}`
- `legacyModuleMigrationTasks/{taskId}`

Each module contract should store:

- `moduleKey`
- `displayName`
- `sourcePath`
- `sourceSystem`
- `integrationStatus`
- `writePolicy`
- `recommendedNexusTarget`
- `requiredDataContracts`
- `blockedLegacyBehaviors`
- `lastReviewedAt`

Implemented in Nexus:

- Admin > Integration inventory now has a `Downloaded CODES study` section.
- `prepareLocalCodeReferenceContracts` stores curated module contracts in `legacyModuleContracts`.
- These contracts are metadata only. They do not scan, run, copy, or write to `C:\Users\PC\Downloads\CODES`.
- SharePoint and local reference contracts remain separated so production automations are not affected.

## Recommended Integration Order

1. StockFix dashboard and task UI references.
2. Call Cycle Coverage data model and hierarchy logic.
3. PG Rep Attendance dashboard mapping references.
4. Sales Insights dashboard/API contract shapes.
5. Training Hub reporting patterns.
6. Connect notifications.
7. Image recognition as a separate future AI service.

## Main Conclusion

The `CODES` folder is useful, but it should not be merged into Nexus as-is. It contains multiple older apps with different auth models, databases, SharePoint write helpers, local scheduled tasks and machine-specific paths.

The correct plan is to catalogue the modules, extract the designs and data contracts, then rebuild the selected functionality inside Nexus using Firebase-native services and the existing Nexus permission model.
