# DataOrbis Monthly Sales

## Delivered

- Wilmar Game / Makro / Jumbo has an executable monthly workflow behind Run Job.
- Credentials remain in the existing client-specific extraction profile and encrypted secret record. They were not copied between Wilmar and Espen.
- Portal OTPs are entered in Nexus by the run owner. Schedules remain off.
- The workflow selects one supplier and one complete month, captures both report folders, checks the raw schemas and reconciles quantities against the portal summary.
- Game Online and non-SA Game stores are excluded from the sales sheet by the user's explicit instruction, with rows and totals retained in the audit.
- Other clients' template rows are preserved and read back for verification. Duplicate client/month batches are not appended again.
- A month-level lock prevents overlapping admin jobs; a late cancelled worker cannot overwrite a newer retry's batch state.
- Output is private Nexus Files, not SharePoint. No SharePoint destination was provided.

## Verified August Output

`Aug26- ALL Clients by SKU.xlsx`

- Original rows preserved: 178,937.
- Wilmar rows added: 1,516 (Game 607, Makro 576, Jumbo 333).
- Final rows: 180,453.
- Excluded rows: 12; excluded units: 3,113; excluded value: 211,080.
- Final Wilmar units: 214,620; copied sales value: 25,369,237.
- Unresolved mapping exceptions: zero.
- 619 duplicate Game Total rows were removed only after exact detail reconciliation.

DataOrbis Copy Raw Data returns HTML tables with English thousands separators and whole-unit monetary cells. Game detail differs from its independently captured summary by R2; wholesale differs by R38. Those differences fall within the portal's per-cell rounding bounds. No unreported cent precision or guessed scaling was introduced.

The final file was built and read back using the authenticated operator-assisted validation session. It was then saved to Nexus Files, with provider upload size and MD5 checks. The deployment account has create-only access to these storage objects; no permissions were broadened. The cloud worker separately requires SHA-256 verification after downloading its inputs and after uploading an output.

## Remaining Validation

The user declined another OTP attempt because the contact was no longer available. No new interactive cloud run was started. The live portal sequence, final workbook, Run controls and OTP UI were tested, but a full run inside the deployed cloud worker is still unverified.

Espen was not activated because its own supplier selection and export have not been validated. Its saved credentials and profile remain unchanged.

August has the supplied approved template and frozen mapping inputs. A different month requires its approved template to be registered; the worker rejects an absent or mismatched month instead of reusing August. Re-running completed August returns the verified run rather than duplicating rows. Replacing an already completed month's source requires an explicit reconciliation process, not another append.

## Deployment Scope

Production source was captured independently for `processExtraction`, `startExtraction` and `getOperationsWorkspace`. Only DataOrbis branches and modules were added to those snapshots. Memory, CPU, secrets, IAM and Eventarc configuration were preserved. Hosting changed only `app.js`, `index.html` and `service-worker.js`; the previous owner-only OTP polling repair was retained.

No-ETLs performance work, Salesforce, Geo Rep, dashboards and Azure migration were not changed by this release.

Evidence and hashes are under `.tmp/dataorbis-workflow-20260923/`. The release scripts deliberately do not deploy the dirty local `functions/index.js` or the full local `public/` directory.

## Recovery

- Cancel an active job in Nexus before retrying. The next manual request can replace a cancelled job's logical lock.
- Missing mappings, input hash changes, incomplete months and duplicate partitions stop publication.
- A future cloud validation needs a fresh OTP entered in Nexus, not chat. It must use an approved monthly template and must not duplicate the completed August batch.
- To disable new Wilmar runs, set only `retailers/dataorbis-game-sales.salesProcedure.automationReady` to false. Do not delete its credentials or the verified output.
