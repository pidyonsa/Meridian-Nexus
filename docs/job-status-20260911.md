# Collapsible Job Status

- The sidebar has a **Job status** control near Account. Its dimensions stay constant when a job starts or updates. The detail panel starts closed and opens only on request.
- Hide it with its close button, the sidebar control or Escape. Clicking outside, scrolling the dashboard, or navigating to another view dismisses it without stopping the job.
- The status panel is non-modal, fixed to the viewport outside the dashboard DOM, width-constrained away from the desktop sidebar, and internally scrollable on smaller screens. Its close control remains visible on long messages. It does not lock body scrolling or capture clicks outside its own bounds.
- Background progress updates never reopen it or modify a dashboard/sidebar's layout. Completion no longer schedules a timer capable of hiding a newer job.
- Existing inline Admin progress displays and the confirmation-protected Abort job action remain intact. No automation, source-data, backend, security-rule or job scheduling behavior changed.
- Account changes clear the panel and its private status text. The control is available only after staff sign-in. Display state and status data are not persisted across accounts or reloads.

## Cause and Verification

`renderExtractionRun` previously replaced the entire banner class name, dropping `global-automation-status`. The banner could then occupy normal document flow and displace dashboard/sidebar layout. A separate `NexusJobStatus` controller now owns presentation, with ID-scoped positioning independent of run-status classes.

Tests cover hide/show, passive updates, page and sidebar geometry, Escape/focus restoration, outside clicks, navigation, dashboard versus panel scrolling, long status messages, old completion timers, account clearing, and the explicit abort action. Viewports: 1440, 1024, 768, 640, 390 and 320 pixels. Existing seven-tab Franchise orders and Support staff/admin browser suites also pass against staged production assets.

Release: `scripts/release-job-status.cjs`. Evidence: `.tmp/job-status-release-20260911/`; screenshots: `.tmp/job-status-verification/`. Hosting is cloned from its live baseline with only app, index, service-worker, job-status.js and job-status.css changed. The dirty root workspace must not be deployed wholesale.
