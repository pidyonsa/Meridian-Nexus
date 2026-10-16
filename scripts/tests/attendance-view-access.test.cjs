const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const helper = fs.readFileSync(path.join(__dirname, "../../functions/index.js"), "utf8").match(/async function requireAttendanceViewPermission\(request\) \{[^]*?\r?\n\}/)[0];
function fixture(profile = { role: "normal", permissions: { allowedNavigationIds: ["attendance"], allowedRetailerIds: ["other"] } }) {
  const context = vm.createContext({ HttpsError, db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: !!profile, data: () => profile }) }) }) }, requestRole: r => r.auth?.token?.role || "", requireOperator(r) { if (!r.auth || !["normal", "admin"].includes(r.auth.token.role)) throw new HttpsError("permission-denied", "Staff only"); } });
  vm.runInContext(helper, context);
  return { allow: context.requireAttendanceViewPermission, request: { auth: { uid: "staff", token: { role: "normal" } } } };
}
test("attendance-only normal users need no automation permission", async () => { const f = fixture(); await f.allow(f.request); });
test("all absent, revoked menu, disabled and client profiles fail closed", async () => {
  for (const p of [null, {}, { role: "normal", permissions: { allowedNavigationIds: [] } }, ...[{ disabled: true }, { accountType: "client" }, { chatAccess: { audience: "external" } }, { chatAccess: { workRole: "Client" } }, { role: "client" }].map(x => ({ role: "normal", permissions: { allowedNavigationIds: ["attendance"] }, ...x }))]) { const f = fixture(p); await assert.rejects(f.allow(f.request), { code: "permission-denied" }); }
});
test("signed-out, client claims and non-staff tokens cannot read attendance", async () => { const f = fixture(); await assert.rejects(f.allow({}), { code: "permission-denied" }); f.request.auth.token.chatClient = true; await assert.rejects(f.allow(f.request), { code: "permission-denied" }); f.request.auth.token = { role: "client" }; await assert.rejects(f.allow(f.request), { code: "permission-denied" }); });
test("administrator retains read access", async () => { const f = fixture(null); f.request.auth.token.role = "admin"; await f.allow(f.request); });
