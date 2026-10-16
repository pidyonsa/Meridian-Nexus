const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.CHAT_EMULATOR_PORT || 8186);
const legacyJar = "C:/Users/PC/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar";
const currentJar = "C:/Users/PC/.cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar";
const testJava = path.join(root, ".tmp/multi-admin-20260910/test-runtime/jdk-21.0.12.1+1-jre/bin/java.exe");
// Firebase CLI prunes older emulator jars when it installs the current version.
const useCurrent = !fs.existsSync(legacyJar) && fs.existsSync(currentJar) && fs.existsSync(testJava);
const java = process.env.CHAT_JAVA || (useCurrent ? testJava : "C:/Program Files/Eclipse Adoptium/jdk-17.0.17.10-hotspot/bin/java.exe");
const jar = process.env.CHAT_EMULATOR_JAR || (useCurrent ? currentJar : legacyJar);
function ready() { return new Promise(resolve => { const socket = net.connect(port, "127.0.0.1"); socket.once("connect", () => { socket.destroy(); resolve(true); }); socket.once("error", () => resolve(false)); }); }
(async () => {
  if (await ready()) throw new Error(`Port ${port} is occupied. Choose another CHAT_EMULATOR_PORT.`);
  const emulator = spawn(java, ["-jar", jar, "--host", "127.0.0.1", "--port", String(port), "--project_id", "demo-meridian-chat"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let logs = ""; emulator.stdout.on("data", data => { logs = (logs + data).slice(-6000); }); emulator.stderr.on("data", data => { logs = (logs + data).slice(-6000); });
  try {
    for (let i = 0; !(await ready()); i++) { if (i > 60 || emulator.exitCode !== null) throw new Error(`Emulator did not start: ${logs}`); await new Promise(resolve => setTimeout(resolve, 500)); }
    const test = spawn(process.execPath, ["--test", "scripts/tests/meridian-chat.test.cjs"], { cwd: root, windowsHide: true, stdio: "inherit", env: { ...process.env, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}` } });
    process.exitCode = await new Promise(resolve => test.on("exit", resolve));
  } finally { emulator.kill(); await new Promise(resolve => emulator.exitCode !== null ? resolve() : emulator.once("exit", resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
