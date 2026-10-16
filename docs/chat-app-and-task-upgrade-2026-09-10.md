# Meridian Chat, App and Task Upgrade

## Included

- An orange Chat badge throughout the Nexus sidebar counts unread **conversations**, not individual messages. Zero is hidden; 100 or more shows `99+` with the exact count in its accessible label. Own messages, removed messages, archived rooms and inaccessible rooms do not increase the count. Read receipts clear it. The browser title and supported installed-app icon also receive a badge while Nexus is running.
- Chat activity stays connected when another dashboard is open. The small room listener invalidates an authoritative all-room server summary; it does not cap the count at 100 rooms. A visible-page refresh checks task reminders once per minute.
- Install app and notification settings are available in the sidebar. Existing Nexus login and staff permissions remain mandatory. This is an installable progressive web app, not an APK or an App Store release.
- Foreground message and task sounds, volume adjustment, a sound test and one/eight-hour muting. Browser interaction is needed to unlock audio. Duplicate events are suppressed across tabs where Web Locks is supported. Historic unread messages do not all sound at login.
- Privacy-safe message, assignment and reminder notifications contain no conversation, customer, product or employee text. Revoked membership, disabled staff and completed/cancelled tasks are checked before delivery. Messages already read do not produce delayed push alerts.
- My Tasks now supports direct task creation, tasks assigned to me or created by me, status/priority/due filters, store/product search, overdue/today/blocked counts and paged results. Filtering happens before pagination.
- Up to 20 checklist steps, optional completion-note requirements, reasons for blocked tasks, a completion timestamp and the latest 30 progress-history entries. Assignees can complete steps; only task managers can change the steps or completion requirements. Conflicting updates require reopening the task.
- Direct tasks must be shared with an existing staff conversation. Assignment permission and active membership are checked server-side. AI drafts and message-to-task workflows still require review before task creation.
- Existing groups, replies, reactions, editing/removal, attachments, voice notes, offline message queue and private AI follow-up memory are retained.

## Activation Still Required

The live project does not have `CHAT_WEB_PUSH_PUBLIC_KEY` configured. Foreground sounds and unread counts work without it, but **closed-app/background push is not yet enabled**.

1. In Firebase project `meridain-nexus`, open Project settings > Cloud Messaging > Web Push certificates. Generate a key pair if none exists. Provide the **public** key only; never share the private key.
2. Configure that public key on the existing `meridianChat` callable, preserving all other environment variables and service settings.
3. Each staff member selects Enable notifications on their own device. Test a real message, assignment and reminder with Nexus both open and closed before wider rollout.

Firebase documents the public VAPID key configuration in its [web messaging setup guide](https://firebase.google.com/docs/cloud-messaging/web/get-started).

On iPhone/iPad, install through Safari's Share > Add to Home Screen, open that installed app, then enable notifications. Home Screen web push requires iOS/iPadOS 16.4 or later. [WebKit guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Closed-app notification sound is chosen by the operating system. Nexus cannot force a custom sound, bypass Focus/Do Not Disturb or override denied notification permission. Its mute preference makes push notifications silent; they remain available visually. [Notification sound behavior](https://developer.mozilla.org/en-US/docs/Web/API/Notification/silent).

Assignments and timed reminders use the existing five-minute scheduler. Foreground polling can alert sooner. A phone's power-saving and notification policies can delay delivery. With push unavailable, keeping a browser tab open is not equivalent to reliable closed-app delivery.

The app caches public shell assets only. It does not make private dashboards or conversations generally available offline. Queued outbound messages are retained on that browser profile, retried with the original request ID, re-authorized on send and cleared on account changes.

## Recommended Next Steps

| Priority | Enhancement | Meridian Benefit | Control Needed |
| --- | --- | --- | --- |
| Next | Reusable visit/task templates and recurring schedules | Consistent shelf, stock, pricing and display checks across reps and merchandisers | Named owner, due-date rules and no duplicate recurring jobs |
| Next | Task-specific completion evidence | Photos, stock counts and store references attached to the exact task | Private attachments, malware scanning and retention policy |
| Next | Manager team queue and overdue escalation | Follow up on unresolved store issues without scanning every chat | Hierarchy-based scope, escalation timing and quiet hours |
| Next | AI daily brief and reviewed task suggestions | Summarize permitted sales, inventory, attendance and outstanding work | Source links, freshness, permission tests, human confirmation before action |
| Later | Approval and dependency workflows | Route completed work to a manager and sequence related follow-ups | Immutable audit events and explicit approver rights |
| Later | Message search, per-room muting and notification preferences | Help field staff separate urgent operational conversations from general discussion | Membership-filtered search and clearly defined urgent-message policy |
| Rollout | Managed-device security, retention and support ownership | Reduce risk on shared/lost phones and clarify operational responsibility | Session revocation, MDM where available, recovery tests and no confidential lock-screen previews |
| Scale | Materialized unread counters and task indexes | Lower repeated reads as user and conversation volumes grow | Transactional counter reconciliation and measured load/cost tests |

This is not an end-to-end encrypted messenger. Access remains controlled by Nexus/Firebase authentication, server authorization and room membership; platform administrators with infrastructure privileges remain part of the trust boundary.

## Verification and Release Scope

- Published to `https://meridian-nexus.web.app/#chat` on 10 September 2026. Hosting version: `64c5b64c0245ce14`; asset version: `20260910-chat-app`.
- Backend revisions: `meridianchat-00005-mid`, `notifymeridianchatmessage-00002-rad`, `delivermeridianchatreminders-00002-sux`. Runtime, IAM and trigger semantics were verified unchanged.
- 57 backend/emulator tests: staff and client boundaries, assignment permissions, checklist completion, overdue filters beyond the first page, 105 unread rooms, account revocation, attachments, reminders, private AI memory and task review.
- Five worker tests: private cache exclusions, UID-safe notification clicks, generic payloads, foreground/mute sound behavior and bounded AI-provider retry.
- Browser checks: desktop, 390px and 320px layouts; orange badge, sound test, duplicate suppression, mute, install prompt, direct tasks and checklists. Existing groups/replies/reactions, voice, attachments, offline retries and AI task drafting also passed.
- Integrated staged-portal checks: badges on Stock Fix, sign-out/account isolation, staff Admin behavior and shared dashboard caching passed. All tests use synthetic data; they do not prove real-device FCM delivery.
- Live callable smoke test passed with two temporary normal staff accounts: unread/read clearing, direct task creation, idempotent retry, checklist completion/history, filtered tasks, assignment activity and immediate opt-out denial. Both accounts and their synthetic chat/task records were deleted successfully. No real staff conversations were read and no device tokens were registered.
- Isolated deployment replaces only the Chat/task modules in `meridianChat`, `notifyMeridianChatMessage` and `deliverMeridianChatReminders`, plus nine Hosting assets. Runtime settings, IAM, security rules, attendance, ETLs and other workers are preserved.
- Release tooling: `scripts/release-chat-app.cjs`. Captured baseline, tests, hashes and deployment results are in `.tmp/chat-app-20260910/`. Do not deploy the entire dirty workspace as this release.
