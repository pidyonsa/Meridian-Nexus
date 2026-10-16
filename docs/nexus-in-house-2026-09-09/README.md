# Meridian Nexus: In-House Risk and Benefit Assessment

Updated 9 September 2026 for the CEO and MD. Three-slide PowerPoint and matching three-page PDF; editable architecture and tables, with fuller speaker notes in PowerPoint and `speaker-notes.txt`.

## Recommendation

Retain Meridian-led product development and Meridian-controlled code, cloud accounts, data rights and release acceptance. Fund named engineering backup and specialist cloud/security support. Retain useful Geo Rep and Catalyst services; replace them only after authorised source access, data reconciliation, support and recovery are proven.

This supersedes the hosting recommendation in the 8 September field-operations brief. It does not change the app or any cloud resource.

## Evidence and Limits

- Meridian reports a new dedicated Johannesburg account. The cloud platform and whether migration is completed are not confirmed. The deck deliberately uses a Johannesburg logical architecture, not a false infrastructure sign-off or an assumed Azure migration.
- Approximately 1,000 users is the total across field, office and authorised client viewers. Concurrent usage, field licence counts and monthly order/image/AI/message volumes remain unknown.
- Risk levels and owners are proposals, not findings from a new security audit. Medium residual risk is a target conditional on accepted test evidence.
- No supplier pricing, independently measured service commitments or workload-sized cloud estimate was supplied. The deck therefore uses a transparent cost model, not fabricated cost savings or quotes.
- Geo Rep's public capabilities and supplied pitch are supplier claims. White-labelling does not by itself give Meridian ownership of the underlying provider platform.
- Catalyst is an external AWS supplier per Meridian's brief; its API remains pending. Geo Rep order capture is not retailer sell-out for Insights.
- The Johannesburg design basis does not certify the location of external APIs, AI processing, identity services or regional disaster recovery.
- In-house capability and cloud-provider choice are separate decisions. An account in a different cloud does not automatically replace Firebase Auth, Firestore, Storage, rules, functions and workers.

## Sources

Primary sources accessed 9 September 2026, linked on the slides and expanded in speaker notes:

1. [Microsoft Azure region list](https://learn.microsoft.com/en-us/azure/reliability/regions-list): South Africa North is Johannesburg; individual service availability must be checked.
2. [Cloud Firestore locations](https://firebase.google.com/docs/firestore/locations): Johannesburg is `africa-south1`; an existing database's location cannot simply be edited.
3. [Geo Rep product features](https://georep.com/product-features/): supplier descriptions of field sales, tasks, forms and offline workflows, not verified Meridian commercial entitlements.
4. [Microsoft shared responsibility](https://learn.microsoft.com/en-us/azure/security/fundamentals/shared-responsibility): the customer retains security responsibilities for data, identities, access and devices.
5. [Information Regulator POPIA guidance](https://inforegulator.org.za/popia/): security safeguards and security-compromise responsibilities. The presentation is not legal advice; Meridian's Information Officer should validate obligations.
6. [Azure pricing calculator](https://azure.microsoft.com/en-us/pricing/calculator/) and [Google Cloud pricing calculator](https://cloud.google.com/products/calculator): estimate tools, not quotes for Nexus.
7. Meridian-supplied `Geo_Rep_Meridian_Partnership.pptx`, slides 4, 6, 15, 16, 17 and 20; user brief; prior field-operations presentation.

## Rebuild and Verification

Run `node docs/nexus-in-house-2026-09-09/build.cjs`, then `powershell -NoProfile -File docs/nexus-in-house-2026-09-09/export.ps1` from the workspace. Uses the existing local PptxGenJS toolchain and installed Microsoft PowerPoint. Output is confined to this document folder.

The builder checks slide count, speaker-note count, text-box intersections and arithmetic. The exporter checks PowerPoint's measured text bounds and renders every page at 1600 x 900 before PDF export. The PNGs in `rendered` are for visual review.
