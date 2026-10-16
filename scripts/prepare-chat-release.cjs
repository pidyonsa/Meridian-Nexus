const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const stage = path.join(root, ".tmp/chat-release");
const JSZip = require(path.join(root, "functions/node_modules/jszip"));
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const gcloud = (...args) => execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 8 * 1024 * 1024 });
const saveHandler = code => code.match(/exports\.saveAdminUser = onCall\(async \(request\) => \{[^]*?\n\}\);/)[0];
const nav = code => code.match(/const navigationPermissionIds = new Set\([^]*?\);/)?.[0];
async function main() {
  const local = read(path.join(root, "functions/index.js"));
  const manifest = [];
  // The live workspace reader spreads profile.permissions without filtering
  // navigation IDs, so saving the new grant is sufficient. Do not redeploy it.
  const workspaceBaseline = read(path.join(stage, "getOperationsWorkspace/index.js"));
  assert.ok(workspaceBaseline.includes("...(profile.permissions || {})"));
  assert.ok(!workspaceBaseline.includes("allowedNavigationIds:"));
  for (const name of ["saveAdminUser"]) {
    const before = JSON.parse(gcloud("functions", "describe", name, "--gen2", "--region=us-central1", "--project=meridain-nexus", "--format=json"));
    fs.writeFileSync(path.join(stage, `${name}.before.json`), JSON.stringify(before, null, 2));
    const source = before.buildConfig.source.storageSource;
    const zip = path.join(stage, `${name}-${source.generation}.zip`);
    if (!fs.existsSync(zip)) gcloud("storage", "cp", `gs://${source.bucket}/${source.object}#${source.generation}`, zip, "--project=meridain-nexus");
    const destination = path.join(stage, name);
    fs.mkdirSync(destination, { recursive: true });
    const archive = await JSZip.loadAsync(fs.readFileSync(zip));
    for (const entry of Object.values(archive.files)) {
      if (entry.dir) continue;
      const target = path.resolve(destination, entry.name);
      assert.ok(target.startsWith(destination + path.sep), "Unsafe archive path");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await entry.async("nodebuffer"));
    }
    const baseline = read(path.join(destination, "index.js"));
    fs.writeFileSync(path.join(stage, `${name}.before.js`), baseline);
    const oldNav = nav(baseline);
    assert.ok(!oldNav?.includes('"chat"'), "Already changed; review staging");
    assert.ok(oldNav || name === "saveAdminUser", "Workspace allowlist needs manual review");
    let updated = oldNav ? baseline.replace(oldNav, () => nav(local)) : `${nav(local)}\n${baseline}`;
    if (name === "saveAdminUser") {
      const imported = 'const { chatAccessFromInput } = require("./meridian-chat");\n';
      updated = imported + updated.replace(saveHandler(baseline), () => saveHandler(local));
      let reversed = updated.replace(imported, "").replace(saveHandler(local), () => saveHandler(baseline));
      reversed = oldNav ? reversed.replace(nav(local), () => oldNav) : reversed.replace(`${nav(local)}\n`, "");
      assert.equal(reversed, baseline);
      fs.copyFileSync(path.join(root, "functions/meridian-chat.js"), path.join(destination, "meridian-chat.js"));
    } else assert.equal(updated.replace(nav(local), () => nav(baseline)), baseline);
    fs.writeFileSync(path.join(destination, "index.js"), updated);
    const modules = path.join(destination, "node_modules");
    if (!fs.existsSync(modules)) fs.symlinkSync(path.join(root, "functions/node_modules"), modules, "junction");
    execFileSync(process.execPath, ["--check", path.join(destination, "index.js")]);
    manifest.push({ name, revisionBefore: before.serviceConfig.revision, changed: name === "saveAdminUser" ? ["saveAdminUser handler", "chat validation module", "navigation allowlist"] : ["navigation allowlist only"] });
  }
  const chat = path.join(stage, "meridianChat");
  fs.mkdirSync(chat, { recursive: true });
  for (const name of ["package.json", "package-lock.json", ".gcloudignore", ".gitignore"]) {
    const source = path.join(stage, "saveAdminUser", name);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(chat, name));
  }
  fs.copyFileSync(path.join(root, "functions/meridian-chat.js"), path.join(chat, "meridian-chat.js"));
  fs.writeFileSync(path.join(chat, "index.js"), 'const { initializeApp } = require("firebase-admin/app");\nconst { getFirestore, FieldValue, FieldPath } = require("firebase-admin/firestore");\nconst { getAuth } = require("firebase-admin/auth");\nconst { onCall, HttpsError } = require("firebase-functions/v2/https");\nconst { buildChat } = require("./meridian-chat");\ninitializeApp();\nObject.assign(exports, buildChat({ db: getFirestore(), getAuth, onCall, HttpsError, FieldValue, FieldPath }));\n');
  fs.writeFileSync(path.join(stage, "function-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}
main().catch(error => { console.error(error.message.slice(0, 1000)); process.exitCode = 1; });
