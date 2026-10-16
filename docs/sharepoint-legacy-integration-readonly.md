# SharePoint Legacy Integration: Read-Only Phase

Nexus is currently integrating legacy SharePoint modules in read-only mode.

## Active Boundary

- Nexus may read module folders through Microsoft Graph.
- Nexus may store file metadata, source paths, module contracts, and migration readiness in Firestore.
- Nexus may use UI/code files as design and workflow references.
- Nexus must not execute legacy scripts from SharePoint.
- Nexus must not modify, rename, delete, overwrite, or create files in legacy module source folders during this phase.

## Read-Only Module Sources

- `Portal`
- `Stock Fix`
- `Call Cycle Coverage`
- `P&G Call Cycle Coverage`
- `Capture/Capture` for Geo Rep Capture handover review
- `Sales Insights`
- `Connect/Notifications`

## Firestore Preparation

The SharePoint inventory scan writes:

- `sharePointIntegrationInventory/current`
- `sharePointIntegrationInventory/current/items/*`
- `sharePointIntegrationScans/*`
- `legacyModuleContracts/{moduleKey}`

These documents are metadata contracts only. They prepare the Firebase data model for later migration without changing SharePoint files.

## Migration Rule

Before Nexus writes replacement data to Firestore or SharePoint for any legacy module, the module needs:

- approved source contract,
- expected worksheets/files/schema,
- ownership and permission decision,
- backup/rollback plan,
- explicit deployment approval.
