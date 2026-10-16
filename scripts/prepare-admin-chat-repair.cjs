const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), stage = path.join(root, '.tmp/admin-chat-repair-20260909');
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const local = name => read(path.join(root, name));
const source = name => read(path.join(stage, name));
function once(text, from, to) { assert.equal(text.split(from).length, 2, `Expected one anchor: ${from.slice(0, 90)}`); return text.replace(from, () => to); }
function match(text, expression) { const found = text.match(expression); assert.ok(found, `Missing block ${expression}`); return found[0]; }
const saveHandler = /exports\.saveAdminUser = onCall\(async \(request\) => \{[\s\S]*?\n\}\);/;
const adminSubmit = /elements\.adminUserForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*?\n\}\);/;
const functionBlock = name => new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`);
const localApp = local('public/app.js'), localFunctions = local('functions/index.js');
const manifest = {};
function overlay(destination, name, content) { fs.mkdirSync(path.join(stage, destination), { recursive: true }); fs.writeFileSync(path.join(stage, destination, name), content); }
const beforePath = path.join(stage, 'saveAdminUser.before.js');
if (!fs.existsSync(beforePath)) fs.copyFileSync(path.join(stage, 'saveAdminUser/index.js'), beforePath);
const original = source('saveAdminUser.before.js');
const oldHandler = match(original, saveHandler), newHandler = match(localFunctions, saveHandler);
const updated = once(original, oldHandler, newHandler);
assert.equal(once(updated, newHandler, oldHandler), original);
overlay('saveAdminUser', 'index.js', updated);
overlay('saveAdminUser', 'admin-user-errors.js', local('functions/admin-user-errors.js'));
overlay('saveAdminUser', '.gcloudignore', '.gcloudignore\n.git\nnode_modules\n');
manifest.saveAdminUser = { changed: ['saveAdminUser handler only', 'admin-user-errors.js'], unchangedOtherExports: true };

let app = source('live-app.js');
for (const expression of [adminSubmit, functionBlock('resetAdminUserForm'), functionBlock('editAdminUser')]) app = once(app, match(app, expression), match(localApp, expression));
let index = source('live-index.html');
const status = '                    <p id="adminUserSaveStatus" role="status" aria-live="polite" hidden></p>\n';
const anchor = '                    <div class="form-actions"><button class="danger-button" id="deleteAdminUser"';
index = once(index, anchor, status + anchor);
index = once(index, 'app.js?v=20260909-attendance-staff-access', 'app.js?v=20260909-admin-user-repair');
let sw = source('live-service-worker.js');
sw = once(sw, '"meridian-nexus-v52"', '"meridian-nexus-v53-admin"');
sw = once(sw, 'app.js?v=20260909-attendance-staff-access', 'app.js?v=20260909-admin-user-repair');
for (const [name, content] of Object.entries({ 'app.js': app, 'index.html': index, 'service-worker.js': sw })) overlay('admin-hosting', name, content);
manifest.adminHosting = { changed: ['app.js: Admin submit/reset/edit only', 'index.html: save status and version only', 'service-worker.js: version only'], excludesPendingEtls: true, chatUnchanged: true };

const assistantBefore = path.join(stage, 'askNexusAssistant.before.js');
if (!fs.existsSync(assistantBefore)) fs.copyFileSync(path.join(stage, 'askNexusAssistant/index.js'), assistantBefore);
const aiOriginal = source('askNexusAssistant.before.js');
let ai = aiOriginal;
const aiExpressions = [functionBlock('askGemini'), functionBlock('nexusAssistantWorkspaceContext'), /exports\.askNexusAssistant = onCall\([^]*?\n\}\);/];
const aiBlocks = [];
for (const expression of aiExpressions) {
  const from = match(ai, expression), to = match(localFunctions, expression);
  aiBlocks.push([from, to]); ai = once(ai, from, to);
}
let reversed = ai;
for (const [from, to] of aiBlocks.reverse()) reversed = once(reversed, to, from);
assert.equal(reversed, aiOriginal);
overlay('askNexusAssistant', 'index.js', ai);
for (const name of ['assistant-access.js', 'assistant-memory.js', 'meridian-chat.js', 'chat-media.js', 'chat-notifications.js']) overlay('askNexusAssistant', name, local(`functions/${name}`));
overlay('askNexusAssistant', '.gcloudignore', '.gcloudignore\n.git\nnode_modules\n');
manifest.assistant = { changed: ['askNexusAssistant', 'askGemini', 'nexusAssistantWorkspaceContext permission flags', 'supporting chat/memory modules'], unchangedOtherExports: true };

for (const name of ['meridian-chat.js', 'chat-media.js', 'chat-notifications.js', 'assistant-memory.js']) overlay('chat-functions', name, local(`functions/${name}`));
overlay('chat-functions', 'index.js', local('functions/chat-entry.js'));
const pkg = JSON.parse(local('functions/package.json'));
pkg.name = 'meridian-chat-functions'; pkg.dependencies = Object.fromEntries(['firebase-admin', 'firebase-functions', 'jszip'].map(name => [name, pkg.dependencies[name]]));
overlay('chat-functions', 'package.json', JSON.stringify(pkg, null, 2));
overlay('chat-functions', '.gcloudignore', '.gcloudignore\n.git\nnode_modules\n');
app = once(app, match(app, functionBlock('syncMeridianChat')), match(localApp, functionBlock('syncMeridianChat')));
index = once(index, 'app.js?v=20260909-admin-user-repair', 'app.js?v=20260909-admin-chat-media');
index = index.replaceAll('meridian-chat.js?v=20260908-chat-tasks', 'meridian-chat.js?v=20260909-chat-media').replaceAll('meridian-chat.css?v=20260908-chat-tasks', 'meridian-chat.css?v=20260909-chat-media');
index = once(index, '    <script defer src="meridian-chat.js?v=20260909-chat-media"></script>', '    <script defer src="chat-tools.js?v=20260909-chat-media"></script>\n    <script defer src="meridian-chat.js?v=20260909-chat-media"></script>');
sw = local('public/service-worker.js').replace('meridian-nexus-v53-chat', 'meridian-nexus-v54-admin-chat').replaceAll('app.js?v=20260909-chat-media', 'app.js?v=20260909-admin-chat-media');
for (const [name, content] of Object.entries({ 'app.js': app, 'index.html': index, 'service-worker.js': sw })) overlay('chat-hosting', name, content);
for (const name of ['chat-tools.js', 'meridian-chat.js', 'meridian-chat.css']) overlay('chat-hosting', name, local(`public/${name}`));
manifest.chatHosting = { changed: ['Admin fix', 'chat tools/JS/CSS', 'syncMeridianChat identity hook only', 'service worker push and private-cache protection'], excludesPendingEtls: true };
for (const file of ['saveAdminUser/index.js', 'askNexusAssistant/index.js', 'chat-functions/index.js', 'admin-hosting/app.js', 'chat-hosting/app.js', 'chat-hosting/service-worker.js']) execFileSync(process.execPath, ['--check', path.join(stage, file)]);
fs.writeFileSync(path.join(stage, 'scope-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
