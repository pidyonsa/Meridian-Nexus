# P&G and Nexus: boundary and working agreement (20 October 2026)

Agreed by the Nexus owner at Carin's request (P&G Reports Hub owner). Source: Carin's note of
20 October and her handover documents of 17 October ("P&G Reports Hub", "Nexus & StockFix").

## Separation (since 17 October)

- All P&G processing runs on its own Function App `pg-display-compliance` (rg `rg-pg-display-compliance`)
  with its own storage `pgdisplaycompliance`. The P&G functions on StockFix Validate are switched off and
  their settings and secrets removed.
- The P&G Reports Hub is its own Static Web App `pg-reports-hub` (rg `rg-pg-reports-hub`), built from the
  GitHub repo `meridian-group-za/PG-Reports-Hub`; every push to `main` deploys it.
- No P&G deployment touches Nexus or StockFix, and no Nexus or StockFix deployment touches P&G.

## Agreement

1. **No approval step for P&G Reports Hub work.** Commits and deployments of the hub (and the P&G
   Function App) are Carin's to make, without Nexus sign-off; the hub is in active development. Checked on
   20 October: nothing on the Azure side holds them up (no resource locks or policies on either P&G
   resource group; the hub deploys from `main` with its deployment token). Nexus work does not add any.
   GitHub repository rules could not be checked from the Nexus PC (no access to the org).
2. **Notice before inventory changes.** The P&G inventory pages read one API on StockFix Validate,
   `dashboard-data` (client `P-G`, through the hub's `/api/inventory/*`), refreshed by the weekly inventory
   pipeline. This is P&G's only dependency on Nexus/StockFix. Tell Carin before changing that API, the
   weekly inventory refresh, or anything that would restart or redeploy StockFix Validate.
3. **Microsoft Graph.** Both apps read SharePoint with the same app registration (StockFix Validate's
   `GRAPH_CLIENT_ID` and secret). Carin offered to move P&G to its own registration; recommended, so a
   secret rotation or permission change on one side cannot break the other. Not done yet (decision pending).
4. **Old P&G code in StockFix Validate.** Still deployed but switched off. A cleaned version is ready on
   `stockfix-backend` branch `remove-pg-code` (commit 2fe1822: 35 functions, P&G removed). Per the handover:
   pin `requirements.txt` to the live package's versions first, deploy at a planned time with the rollback
   zips at hand, and give Carin notice (item 2) because the deploy restarts the app that serves inventory.
   Not deployed yet; the Nexus PC has no access to the GitHub org.
