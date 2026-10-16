# Meridian Chat

## Status

Deployed on 8 September 2026 at https://meridian-nexus.web.app/#chat. No real
users, user grants, conversations or messages were created by this release.
Nexus authentication, Firebase infrastructure and the existing navigation remain
in place. Staff messaging also includes a separate private Nexus Assistant conversation. The latest policy
is staff-only with default access; external-client participation is switched off.

- Hosting version: `92ef0d6b6dc224ff`; five changed assets, 50 other assets preserved by hash.
- `meridianChat`: `meridianchat-00003-yoz`, ACTIVE, 256MiB, maximum eight instances.
- `saveAdminUser`: `saveadminuser-00046-pip`, ACTIVE; existing runtime configuration preserved.
- Firestore ruleset: `0a74ec32-d5ec-40ed-8940-e2c4c648e4e2`; both Chat inbox indexes and both task-list indexes READY.
- The live workspace reader already passes through saved navigation permissions and was not redeployed.
- No changes to Storage rules, public-drop Hosting, dashboard source files or automation workers.

Release backups, function configurations, asset hashes and verification results are
under `.tmp/chat-release/`, with this update in `chat-tasks/` and the preceding release in `staff-defaults/`. Treat these operational artifacts as private; they may
include existing runtime configuration. Do not publish that directory.

## Meridian workflows

- Direct staff messages; teams and announcements created by staff with the separate group-creation grant.
- Workstream, region and store context for reps, merchandisers, managers and office teams.
- Explicit participant selection, replies, unread indicators and per-conversation read receipts.
- Priority tags, pinned messages, 15-minute own-message edits and removal; assigned administrators can moderate.
- Archive/restore and controlled membership changes. Newly assigned people can read the complete room history.
- 50 participants per room; paged inbox and message history of 50 items, with only the selected message page subscribed.
- Mobile conversation/back navigation and a compact version of the existing Nexus menu.
- Failed sends keep their draft and request ID for deduplicated retries. No background/offline send queue.
- A searchable picker for 24 common emoji and seven reaction types. Each member has one reaction per message; choosing another replaces it, and choosing the same removes it.
- A message action menu, desktop context menu and mobile long press; copy, reply, edit, remove, pin and create-task actions respect the caller's access.
- Message-linked tasks with assignee, due date, priority, store, product, notes, progress and status. My Tasks and conversation task views have bounded pagination and live updates for the displayed page.

Priority does not send a push notification or automatically create a task. This
release does not implement attachments, voice/video calls, typing/presence,
WhatsApp, AI access to transcripts, or organisation-wide broadcasts to 1,000 users.
These are separate extensions, not nonfunctional buttons in the interface.

## Access model

Active staff already loaded in Nexus have Chat by default. No bulk profile update
or individual grant is required. Accounts must exist in Firebase Auth and the Nexus
`adminUsers` collection; creating a Firebase login alone does not grant Chat access.
The directory excludes missing/disabled Auth accounts and profiles not classified
as staff, as well as client profiles and accounts with client claims.

In Admin > User Management, untick Meridian Chat and save to revoke access; tick it
and save to restore access. The checkbox stores `permissions.chatEnabled`. Missing
means enabled for staff, while explicit `false` denies both the callable and Firestore
reads, including for administrators. Other workspace grants remain independent.

Client access is blocked even when an old profile has a Chat grant, a matching client
key and existing room membership. There is no client-directory or client-room creation
option. Historical conversation data is retained rather than deleted by this policy.

The existing root administrator can configure rooms but cannot read private rooms
without membership. Staff can create direct messages with other eligible staff;
staff with `chatAccess.createGroups` can create groups or announcements. Default Chat access does not
automatically add anyone to existing conversations.

The former client-only login claims are refused at sign-in. Existing client identities
cannot be promoted to staff by editing Chat settings, and new client creation through
this form is unavailable. No existing accounts or claims were bulk-rewritten.
Disabling the profile, switching Chat off in Admin, or removing
membership prevents future authorised reads/writes. The UI clears content on listener
denial and on sign-out; data already seen or copied by a recipient cannot be recalled.

## Private Nexus Assistant

A pinned Nexus Assistant entry opens inside the Chat conversation pane. The floating
assistant launcher is hidden on this route. It reuses `askNexusAssistant` with the
existing fixed `gemini-3.5-flash` model, server-side permission-filtered Nexus context
and usage limits. No additional model, credential or AI backend is introduced.

Only the explicitly submitted question is sent, up to the endpoint's 1,400-character
limit. Staff rooms, participants, drafts and message transcripts are not attached.
Questions are independent; the current endpoint does not receive conversation history.
The interface supports suggested questions, copy, retry and clear-session controls.
Answers are rendered as escaped text, never executable HTML.

The displayed AI session is held in browser memory only, capped at 40 previous turns.
It is cleared when leaving Chat, signing out or receiving an access denial. Pending
answers cannot restore a cleared or revoked session. Clearing the interface does not
cancel already dispatched processing or erase backend/provider audit records. Normal
staff drafts and AI drafts remain separate when switching between conversations.

## Tasks and responsibilities

Admin > User Management > Chat responsibilities controls `chatAccess.createGroups`,
`assignTasks` and `moderateMessages`. These default off for ordinary staff and on for
the root administrator unless explicitly overridden. Older user-editor requests that
omit these fields preserve the existing values. Only the root administrator can grant
these responsibilities; a Chat client cannot self-edit its profile or permissions.
Group owners retain management of their own conversations. The moderation grant lets
staff remove messages in conversations they belong to, not browse other private rooms.

Choose Create task on a message, review the prefilled message text, then save. This is
manual task creation, not AI extraction or automatic assignment. Without `assignTasks`,
staff can create tasks for themselves; assigning others requires that grant, current
room membership and an active eligible Firebase staff account. Clients are never valid
assignees. At most ten tasks can be linked to one message. Idempotent creation retries
do not duplicate a task after a lost response.

Status values are open, in-progress, blocked, completed and cancelled. The assignee can
update status and progress; the creator, conversation owner or assigned administrator
can manage task details or cancel. Reassignment still requires the assignment grant.
Updates include a revision to prevent silently overwriting another person's changes.
Archived conversations make tasks read-only. Completed tasks can be reopened; there
is no task delete button or silent purge of operational history.

Task records live in `meridianChatTasks`, with `roomId` and `sourceMessageId` links.
Every read and mutation verifies membership in the source conversation. Even the root
administrator cannot bypass membership. Removing an assignee from the conversation
removes their task access; a remaining task manager can reassign it. The task can
retain its reviewed note after the original message is removed: message removal is
not task deletion.

List queries run through the authenticated callable, 50 records per page, with fresh
source-room checks. Browser task lists and writes are denied. The visible page uses
bounded per-task listeners, which also enforce current source-room membership and
clear the view on denial. My Tasks contains only tasks assigned to the current user;
conversation tasks are visible to its participants. New task discovery uses Refresh;
updates to tasks already displayed arrive live. Due dates show an overdue indicator,
not a scheduled notification. This release has no reminders or attachment evidence.

The older `nexusAssistantTasks` endpoint remains separate and unchanged. AI task
drafting, follow-up memory, push notifications, attachments, voice notes and offline
sending remain later phases. No staff transcripts are automatically sent to AI.

## Implementation

| File | Responsibility |
| --- | --- |
| `functions/meridian-chat.js` | Callable API, profile checks, transactional membership, sender identity, deduplication, rate limits and metadata audit |
| `functions/index.js` | Export API and validate user-management settings/restricted client claims |
| `public/meridian-chat.js` | Framework-independent interface and Firebase compat adapter |
| `public/meridian-chat.css` | Scoped chat styles; no dashboard restyling |
| `public/app.js`, `public/index.html` | Nexus route, navigation, auth lifecycle and account editor integration |
| `firestore.rules`, `firestore.indexes.json` | Read boundaries, deny browser writes, scoped inbox indexes |
| `public/service-worker.js` | Versioned static shell assets only; chat calls are POST and Firestore is cross-origin |

Collections: `meridianChatRooms/{room}/messages`, `.../receipts`,
`meridianChatReads/{uid}/rooms`, `meridianChatTasks`, `meridianChatLimits`, `meridianChatAudit`.
There are no chat Storage objects. All writes use the callable; rules reject direct
browser writes, including writes attempted by an administrator. Root admins do not
get a private-message bypass. Audit entries contain action/actor/object IDs and
timestamps, not duplicate message text. Message removal creates a tombstone and
clears the room preview/pin where applicable; this is not a backup-erasure guarantee.

Reads are constrained in the actual queries, not merely filtered in the UI,
following [Firebase's query/rules model](https://firebase.google.com/docs/firestore/security/rules-query).
All transaction reads precede writes, following
[Firestore transaction requirements](https://firebase.google.com/docs/firestore/manage-data/transactions).
Authenticated callable traffic still requires server-side checks because the Admin
SDK bypasses Firestore client rules.

## Source adaptation

Reviewed `C:/Users/PC/SIGDAHUILA/src/services/chatService.js` and
`src/Dashboard/components/GroupChat/GroupChat.js` / `.css`, plus its rules.
The direct/group, reply, participant and read-status workflows were ported to the
vanilla Nexus application. The React application was not embedded or imported.
Its Firebase configuration, credentials, user records and message data were not copied.
Its source folder was not modified. No runtime dependency on SIGDAHUILA remains.
The source camera code showed local media previews, not a complete calling transport,
so it was not carried into Meridian Chat. Unbounded listeners and client-authored
sender identities were replaced with the bounded/server-owned implementation here.

## Verification

`node scripts/test-meridian-chat.cjs` starts an isolated `demo-meridian-chat` emulator,
runs the callable/rules tests and terminates the emulator. It refuses an occupied port
and never points the tests at the production project.

`node --test scripts/tests/attendance-sharepoint.test.cjs scripts/tests/stockfix-connectivity.test.cjs`
checks the existing automation/transport and the staff-only login gate.

`node scripts/tests/meridian-chat-browser.cjs` uses a local synthetic adapter in Edge
to check desktop and 390/320px mobile layouts, real icon rendering, safe text handling,
send/retry/reply, staff assignment, blocked clients, denial cleanup, and subscription cleanup.
The same suite checks AI request isolation, separate drafts, retry, escaped output,
pending answers during navigation, clear-session and access revocation, and mobile layout.
Screenshots are under `.tmp/chat-verification/`. The browser tests are not a substitute
for a staging test with actual Firebase Auth/callable credentials.

`node scripts/tests/meridian-chat-shell.cjs` also runs the actual Nexus HTML/app with
a test-only Firebase adapter, checking signed-out, staff and admin navigation,
client denial, default/opt-out and responsibility checkboxes, listener access, the fixed-model AI callable
payload, no staff-message writes from AI, and logout cleanup. The tasks release passed 68 automated tests
plus both browser suites. Browser suites cover desktop and 390/320px mobile layouts.

Live verification confirmed byte-identical delivery of all five changed assets,
HTTP 401 for a signed-out Chat request, HTTP 403 for signed-out Nexus Assistant and user management,
and HTTP 403 for public reads of Chat rooms and the three legacy staff collections.
An authenticated conversation between real production accounts has not been tested;
no production test identities were created or existing users impersonated.
The embedded AI interface and callable payload were verified with mock responses;
a signed-in production Gemini answer still needs a staff pilot check.
The task release additionally tests reactions, delegated group creation, active and
same-room assignees, task retry deduplication, stale revisions, paging, task membership
revocation, direct-write denial and root-admin privacy boundaries. Browser fixtures
exercise task creation/update/reassignment, emoji, mobile long press and revoked task
listeners. Real-device touch behaviour and real-staff task delivery still need a pilot.

Local preview: `node scripts/chat-preview.cjs`, normally at `http://127.0.0.1:8786`.
Append `?client=1` to verify the blocked-client state. Preview identities and content are
synthetic, live only under `scripts/`, and are not part of Firebase Hosting.

Test prerequisites: Java 17 and the cached Firestore emulator JAR, Firebase Admin
and Puppeteer from `functions/node_modules`, plus Firebase/rules-unit-testing SDKs.
The rules suite currently reuses the installed test SDKs from SIGDAHUILA without
modifying that app. Set `CHAT_TEST_SDK_ROOT` to a separate package directory containing
`firebase` and `@firebase/rules-unit-testing` to run independently. Override paths with
`CHAT_JAVA`, `CHAT_EMULATOR_JAR`, `CHAT_EMULATOR_PORT`, and `CHAT_BROWSER` as needed.
Browser screenshot tests use public font/icon assets cached under
`.tmp/chat-verification/vendor`; those are test fixtures, not application data.

## Production gate

Do not bulk-deploy this dirty workspace. Stage and review only the chat changes
alongside the exact current production versions. Deploy the indexes and wait until
ready, then rules, `meridianChat`, `saveAdminUser` and the application Hosting target.
Do not deploy the public-drop target or unrelated functions/rules as part of this release.

Before broad rollout:

- Run a pilot with real staff accounts, including logout, token refresh, opt-out and
  membership removal. External onboarding is not available under the current policy.
- Agree retention, backup retention, incident reporting, client-history disclosure and
  data-processing responsibilities. No retention deletion policy is assumed here.
- Legacy `files`, `dashboardClients` and `dashboardUploads` now require administrator
  access. Their listeners start only after admin authentication and are cleared on
  account changes; delayed staff responses cannot restore the old session's data.
- Separately resolve the existing public file-drop exposure:
  `fileDrops` currently permits public metadata listing/deletion, including access
  keys, and its Storage path permits public reads/deletion. The audit found one
  unexpired room and zero file metadata records. Its use is awaiting confirmation;
  the separate workflow was not silently retired. Never put private Chat data there.
  Rule changes alone would not revoke historical Firebase download-token links.
- Configure/validate App Check, monitoring, budget alerts, appropriate sign-in policies
  and load testing before wide rollout. App Check is not silently enabled in this build.
- Plan large broadcast rooms and higher throughput separately. Sequence allocation
  updates one room document per message, and participant validation is capped at 50.

Messages use Firebase platform security; this is NOT end-to-end encryption. Authorised
infrastructure operators can access stored data. Adding photos/documents later requires
private member-scoped Storage rules, content/size validation and malware scanning;
never reuse the existing public upload/drop paths for private chat attachments.
