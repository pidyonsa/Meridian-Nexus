# Multi-Channel No-ETLs and Staff Chat

## No-ETLs

One Nexus workspace is organised by customer, retail channel and inventory pipeline. Search and customer/channel/readiness filters replace retailer-specific navigation tabs. Run history identifies its customer and channel and can be filtered independently.

The initial catalogue includes Pick n Pay, Clicks, Shoprite, Checkers, Game, Dis-Chem, SPAR, Makro, Woolworths and Boxer. Administrators can add customer/channel combinations, select existing Resources or upload setup workbooks, and save source-report names and mapping requirements.

Only `anchor-pnp-v1` has a deployed, validated transformer. Other combinations have a setup record, not a working transformer. Raw and expected-output samples move a setup from Files required to Mapping required; saving a setup never enables execution. The callable rejects an unvalidated pipeline ID before accessing its inputs or starting a job.

Each setup can reference a raw sample, expected transformed sample, Product List, store-name clean-up, staffing/call-cycle master, DC mapping, channel status codes and inventory template. These selections are separate from the validated Anchor/PnP shared reference set. Uploaded Resources are labelled with their actual customer/channel rather than always being labelled Anchor/PnP.

Setup records use `etlPipelineSetups`, with revision checks and audit records in `etlPipelineSetupAudit`. Existing Admin-only access is retained. Browser-supplied runnable/status flags cannot enable a transformer. The worker, existing approvals, pinned reference snapshots and the 17-column Anchor/PnP transformation are unchanged.

To activate another channel, provide representative raw and correctly transformed samples, confirm identifiers and calculation rules, implement its schema/transformer, and reconcile it against the expected output before enabling it. The UI does not infer financial or inventory mappings from filenames.

## Chat

- Authorised staff Chat warms after Nexus login and stays mounted when moving between dashboards. The five-minute teardown was removed. Returning to Chat does not repeat bootstrap or discard the open conversation/draft.
- Conversation listening begins before offline-queue initialisation finishes. Initial login still needs network authentication; this is not a promise of instant loading on every network.
- Chat content is retained in the current browser session, not a new persistent message cache. Sign-out, account switching and Chat revocation clear the session. A live own-profile listener handles permission changes.
- Conversation rows show numeric unread badges, capped visually at 99+, and saved draft previews. Desktop Enter sends; Shift+Enter inserts a line break. Touch keyboards and IME composition retain their normal Enter behaviour.
- Staff without an explicit override default to group creation and task assignment. Explicit `false` settings remain off. Admin controls display the same defaults as the backend. No staff profiles are bulk-modified.
- Moderation does not default on for normal staff. External clients, disabled accounts and Chat opt-outs remain blocked. Assignments still require active staff membership in the task's conversation.

Existing groups, replies, reactions, attachments, voice notes, reviewed AI task drafting, checklists, reminders and unread/sound controls are retained. This release does not configure a missing Web Push key or alter background-push availability.

## Verification and Release

30 ETL tests, 57 chat/security emulator tests and two warm-navigation tests passed. Headless Edge checks covered channel setup, customer additions, filters, the existing PnP transformation workflow, bounded downloads, shared-reference edits, error recovery, account isolation, chat keyboard behaviour and desktop/mobile layouts.

Release evidence is under `.tmp/channels-chat-20260910/`. The release helper stages current production source and changes only `meridianEtl`, `meridianChat` and seven UI assets. Firebase rules, IAM, runtime configuration, attendance, other dashboards and automation workers are not changed.

Published and verified on 10 September 2026:

- Hosting: `b0a866f229db6e95`, UI asset version `20260910-channels-chat`.
- ETL callable: `meridianetl-00005-tat`.
- Chat callable: `meridianchat-00006-vak`.
- Live checks passed for inherited staff capabilities, explicit opt-outs, Admin-only ETLs, setup saving, stale-revision rejection and blocking unsupported transformations. Shared reference selections were unchanged and no business job was started.
- Temporary verification account and setup record removed, with no cleanup failures. The setup audit entry was retained.
- Refresh Nexus once to load the new UI. Use the staged release helper for subsequent releases; do not publish unrelated pending workspace changes wholesale.

The UI uses native tables and labelled form controls, consistent with [MDN's table accessibility guidance](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/table_role). Setup saves use [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) to reject conflicting edits without partially changing the saved selection.
