'use strict';
const fs=require('node:fs');
const path=require('node:path');
const archiver=require('archiver');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
const archive=archiver('zip',{zlib:{level:9}}),target=path.join(root,'dist/meridian-nexus-azure.zip'),output=fs.createWriteStream(target);
archive.on('error',error=>{throw error;});archive.pipe(output);
for(const dir of ['public','server'])archive.directory(path.join(root,dir),dir);
archive.file(path.join(root,'App_Data/jobs/triggered/nexus-sync/run.sh'),{name:'App_Data/jobs/triggered/nexus-sync/run.sh',mode:0o755});
archive.file(path.join(root,'App_Data/jobs/triggered/nexus-sync/settings.job'),{name:'App_Data/jobs/triggered/nexus-sync/settings.job'});
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));pkg.scripts={start:pkg.scripts.start,sync:pkg.scripts.sync};delete pkg.devDependencies;
archive.append(JSON.stringify(pkg,null,2),{name:'package.json'});
// Keep the generated lockfile; npm ci --omit=dev installs only production dependencies.
archive.file(path.join(root,'package-lock.json'),{name:'package-lock.json'});
archive.file(path.join(root,'PORT_MANIFEST.json'),{name:'PORT_MANIFEST.json'});
output.on('close',()=>process.stdout.write(`${target} (${archive.pointer()} bytes); no original portal, credentials, fixtures, or local data included.\n`));
archive.finalize();
