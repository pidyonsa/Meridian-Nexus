# Nexus Loading Performance

## Findings

The verified live baseline was Hosting version `28cb9f9bb7f6e532`.

- The service worker used network-first with `cache: reload` for the application shell. A working but slow connection could keep cached assets waiting.
- Firebase initialization waited for the window `load` event rather than starting when the deferred application script and DOM were ready.
- Every page downloaded the spreadsheet parser as a deferred startup dependency, although it is only required for the Admin spreadsheet preview.
- Dashboard calls had no common response cache or in-flight request deduplication. Attendance, Call Cycle and Job Summaries independently requested the same Salesforce summary.
- Chat stopped its session and listeners on every route exit, then repeated bootstrap and conversation loading when reopened.
- Resources retained a loaded flag indefinitely. The new bounded cache replaces that unbounded freshness assumption.

These are code-confirmed loading issues. Backend cold-start duration, signed-in production response times and the user's particular network have not been measured. Existing source code shows server-side Firestore/workbook aggregation for some reports, which can still affect a first uncached read; that is not changed in this release.

## Changes

- Cache-first versioned public application assets; cached public HTML appears immediately while its update runs in the background. Known Insights and Call Cycle static assets are cached on first use. API payloads, auth handlers, workbook downloads and Chat attachments bypass the service worker cache.
- Start Firebase as soon as the DOM and deferred scripts are ready. Load the existing, pinned spreadsheet parser only when a user selects a spreadsheet to preview.
- Bounded, in-memory report cache: 60-second fresh window, up to 5-minute stale display while revalidating supported dashboard views, 24 entries and approximately 24 MiB serialized-content budget. There is no new private-data localStorage or IndexedDB persistence.
- Cache key includes user, session generation, role/permissions and canonical request parameters. Logout/account changes clear stored reports and reject late responses. Successful data mutations invalidate reports. Explicit Refresh bypasses stored results.
- Identical in-flight report reads share one network request. Live operations/permission checks may share an in-flight request but are never stored. Writes, task/message actions, AI answers, downloads and exports are not response-cached.
- Stock Fix, dedicated/syndicated Attendance, Call Cycle, Job Summaries and Training can display recent same-session reports during background refresh. Insights route reads, Franchise Order, Resources and the legacy sales reader reuse fresh same-session responses; their stale reads still wait for fresh data.
- Keep Chat mounted for up to five minutes after leaving its page. Return navigation retains the DOM and live listeners. Hidden conversations are not marked read; microphone recording and media playback stop, and dialogs close. Logout/access removal stops the retained session. No unrequested conversations are fetched in advance.
- Insights waits for Nexus authentication before starting and clears its frame on logout/account change. No second sign-in is added.

## Verification

- Ten unit tests cover cache hits, concurrent reads, stable filter keys, response-copy isolation, expiry/eviction, refresh, access denial, account/permission changes, late responses, mutation safety, service-worker offline behavior and exclusion of private URLs.
- The exact staged Hosting assets were exercised in Edge at desktop and mobile sizes using synthetic data and a deliberately delayed API.
- Representative Stock Fix first render was about 735 ms; revisit was about 50 ms, without a second request. These are controlled test figures, not production latency promises.
- Attendance, Call Cycle and Job Summaries reused a single Salesforce report request. Explicit Refresh fetched again. Background refresh retained the report while showing its cached timestamp. Access denial removed prior Stock Fix metrics. A different account did not reuse another account's report.
- Existing Chat regression suite passed: messages, replies, reactions, tasks, AI isolation, revocation and listener cleanup.
- Resources and No-ETLs staged browser regression passed, including shared masters, uploads, 17-column review, approval blocking, error recovery, staff denial and logout cleanup.
- Evidence and exact tested hashes: `.tmp/loading-20260910/browser-verified.json`. Screenshots are in the same directory. The release script verifies tested hashes before publishing.

## Deployment Boundary

Hosting only: `app.js`, `index.html`, `service-worker.js`, `meridian-chat.js`, and new `nexus-load-cache.js`. Build tag `20260910-fast-pages`; service-worker cache `meridian-nexus-v59-fast-pages`.

Published and live asset hashes verified on 10 September 2026 at 05:08 UTC (07:08 Johannesburg): Hosting version `626c58ffec11ae3f`. Release evidence: `.tmp/loading-20260910/verified.json`.

A read-only, signed-out live Edge check also confirmed the new app build, resolved Firebase authentication, no client-side JavaScript exceptions, an empty protected Insights frame, a working Nexus sign-in control and activation of the new cache. Authenticated production performance was not measured; authenticated workflow checks used synthetic fixtures.

All other deployed asset hashes, Hosting configuration, authentication policy, rules, backend functions, IAM, schedules and automation workers are preserved. In particular, this release does not include the pending broader multi-admin changes in the local worktree.

For a rollback, restore the recorded prior Hosting version through the usual release process. The new cache version will be replaced when that version's service worker activates. No business data migration is required.

## Follow-up

Measure authenticated first-load latency per endpoint before changing server capacity or database architecture. If server aggregation dominates, publish versioned dashboard aggregates when imports finish rather than repeating large scans for each viewer. Consider persistent private/offline caches only as an explicit trusted-device feature with a reviewed retention and revocation policy.

References: [Firebase offline-data security guidance](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [Chrome caching strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview).
