const { createServer } = require("./chat-preview.cjs");
const fs = require("node:fs");
const path = require("node:path");
const server = createServer();
server.listen(0, "127.0.0.1", () => {
  const info = { pid: process.pid, url: `http://localhost:${server.address().port}/?enhanced#chat`, syntheticDataOnly: true };
  const destination = path.resolve(__dirname, "../.tmp/chat-enhancements-verification");
  fs.mkdirSync(destination, { recursive: true }); fs.writeFileSync(path.join(destination, "preview.json"), JSON.stringify(info, null, 2));
  console.log(JSON.stringify(info));
});
