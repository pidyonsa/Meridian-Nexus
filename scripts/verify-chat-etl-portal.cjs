"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { stage, portal } = require("./release-chat-etl-portal.cjs");
const root = path.resolve(__dirname, ".."), assets = JSON.parse(fs.readFileSync(path.join(stage, "chat-etl-hosting.assets.json")));
const hashes = Object.fromEntries(Object.entries(assets).map(([name, content]) => [name, crypto.createHash("sha256").update(content).digest("hex")]));
for (const name of ["meridian-chat.js", "meridian-chat.css", "chat-tools.js"]) assert.equal(fs.readFileSync(path.join(root, "public", name), "utf8").replace(/\r\n/g, "\n"), assets[name]);
for (const test of ["admin-user-browser", "etls-browser", "chat-enhancements-browser"]) {
  const output = execFileSync(process.execPath, [`scripts/tests/${test}.cjs`], { cwd: root, windowsHide: true, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NEXUS_PORTAL_STAGE: portal } });
  fs.writeFileSync(path.join(stage, `${test}.feature-check.log`), output); console.log(output.trim());
}
fs.writeFileSync(path.join(stage, "chat-etl-browser-verified.json"), JSON.stringify({ verifiedAt: new Date().toISOString(), syntheticOnly: true, hashes }, null, 2));
