const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const puppeteer = require('../../functions/node_modules/puppeteer-core');
const root = path.resolve(__dirname, '../..'), stage = path.join(root, '.tmp/admin-chat-repair-20260909');
async function main() {
  const multiAdmin = process.env.NEXUS_MULTI_ADMIN_TEST === '1';
  const source = process.env.NEXUS_PORTAL_STAGE || path.join(stage, 'admin-hosting');
  const html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(source, 'app.js'), 'utf8');
  const form = html.match(/<form class="management-panel user-editor-panel" id="adminUserForm">[\s\S]*?<\/form>/)[0];
  const handler = app.match(/elements\.adminUserForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*?\n\}\);/)[0];
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-first-run', '--disable-extensions'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1100, height: 900 });
    const css = fs.readFileSync(process.env.ADMIN_TEST_CSS || path.join(root, 'public/styles.css'), 'utf8');
    await page.setContent(`<html><head><style>${css}</style></head><body><main style="max-width:850px;margin:20px auto">${form}</main></body></html>`);
    await page.evaluate(() => {
      window.calls = [];
      window.elements = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
      window.elements.adminUserNavigation = [...document.querySelectorAll('#adminUserNavigation input')];
      window.auth = { currentUser: { uid: 'synthetic-admin' } };
      window.friendlyError = error => error.message; window.showToast = () => {};
      window.callFunction = async (name, data) => { window.calls.push({ name, data }); return { uid: 'synthetic-staff', role: data.role }; };
    });
    await page.addScriptTag({ content: handler });
    await page.type('#adminUserName', 'Synthetic'); await page.type('#adminUserSurname', 'Staff');
    await page.type('#adminUserEmail', 'staff@example.test'); await page.type('#adminUserPassword', 'test-password');
    await page.select('#adminUserRole', 'admin');
    await page.click('#adminUserForm button[type="submit"]');
    if (multiAdmin) {
      await page.waitForFunction(() => document.querySelector('#adminUserSaveStatus').textContent === 'User saved.');
      assert.equal(await page.evaluate(() => calls.length), 1);
      assert.equal(await page.evaluate(() => calls[0].data.role), 'admin');
      await page.$eval('#adminUserId', node => { node.value = 'synthetic-admin'; });
      await page.select('#adminUserRole', 'normal');
      await page.click('#adminUserForm button[type="submit"]');
      await page.waitForFunction(() => document.querySelector('#adminUserSaveStatus').textContent.includes('Another administrator'));
      assert.equal(await page.evaluate(() => calls.length), 1);
      await page.$eval('#adminUserId', node => { node.value = 'synthetic-staff'; });
    } else {
      await page.waitForFunction(() => document.querySelector('#adminUserSaveStatus').textContent.includes('reserves the Administrator'));
      assert.equal(await page.evaluate(() => calls.length), 0);
    }
    const initialCalls = multiAdmin ? 1 : 0;
    await page.select('#adminUserRole', 'normal');
    await page.focus('#adminUserPassword'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#adminUserSaveStatus').textContent === 'User saved.');
    assert.equal(await page.evaluate(() => calls.length), initialCalls + 1);
    await page.evaluate(() => document.querySelector('#adminUserForm').dispatchEvent(new SubmitEvent('submit', { cancelable: true, bubbles: true })));
    await page.waitForFunction(count => calls.length === count, {}, initialCalls + 2);
    assert.equal(await page.evaluate(index => calls[index].data.uid, initialCalls + 1), 'synthetic-staff');
    assert.equal(await page.evaluate(index => calls[index].data.password, initialCalls + 1), '');
    assert.deepEqual(errors, []);
    const evidence = process.env.ADMIN_TEST_EVIDENCE || stage;
    await page.screenshot({ path: path.join(evidence, 'admin-save-desktop.png'), fullPage: true });
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(evidence, 'admin-save-mobile.png'), fullPage: true });
    console.log(`PASS: ${multiAdmin ? 'pending full Admin promotion and self-removal guard' : 'staged Admin role validation'}, Enter save, null submitter, same-UID retry, no browser errors. Synthetic data only.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
