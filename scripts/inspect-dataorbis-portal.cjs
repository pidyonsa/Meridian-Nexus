"use strict";
const puppeteer = require("../functions/node_modules/puppeteer-core");

async function inspect(page) {
  return page.evaluate(() => ({
    title: document.title,
    path: location.origin + location.pathname,
    text: document.body.innerText.slice(0, 6000),
    inputs: [...document.querySelectorAll("input")].map(e => ({ type: e.type, id: e.id, name: e.name, placeholder: e.placeholder })),
    buttons: [...document.querySelectorAll("button, input[type=submit], [role=button]")].map(e => ({ text: e.innerText || e.value, id: e.id, type: e.type })),
    forms: [...document.forms].map(e => ({ id: e.id, action: e.action, method: e.method }))
  }));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.goto("https://pyramid.dataorbis.com/", { waitUntil: "networkidle2", timeout: 60000 });
    console.log(JSON.stringify(await inspect(page), null, 2));
  } finally {
    await browser.close();
  }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { inspect };
