"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("../functions/node_modules/puppeteer-core");
const { json } = require("./release-multi-admin.cjs");
const { inspectSession, update, unpack, base } = require("./validate-dataorbis-connection.cjs");
async function main() {
  const [profile, runId] = process.argv.slice(2);
  assert.match(profile, /^puppeteer_dev_chrome_profile-[A-Za-z0-9]+$/);
  assert.match(runId, /^dataorbis-wilmar-connection-[a-f0-9-]+$/);
  const port = Number(fs.readFileSync(path.join(process.env.TEMP, profile, "DevToolsActivePort"), "utf8").split(/\r?\n/)[0]);
  assert.ok(port > 0 && port < 65536);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  try {
    const page = (await browser.pages()).find(p => p.url().startsWith("https://pyramid.dataorbis.com/"));
    assert.ok(page, "The authenticated validation page was not found.");
    const profile = unpack(await json(`${base}/retailers/dataorbis-game-sales?mask.fieldPaths=username`));
    await inspectSession(page, profile.username, runId, async () => {
      const run = unpack(await json(`${base}/extractionRuns/${runId}?mask.fieldPaths=status&mask.fieldPaths=cancellationRequestedAt`));
      if (run.cancellationRequestedAt || run.status !== "running") return false;
      await update("extractionRuns", runId, { lastActivityAt: new Date().toISOString(), message: "Validating Wilmar monthly report controls. No workbook published yet." });
      return true;
    });
  } finally { browser.disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
