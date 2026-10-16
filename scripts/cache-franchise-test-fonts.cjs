const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const dir=path.resolve(__dirname,'../.tmp/franchise-verification/vendor');fs.mkdirSync(dir,{recursive:true});
  const response=await fetch('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap');
  if(!response.ok)throw new Error('Font CSS unavailable');const css=await response.text();
  fs.writeFileSync(path.join(dir,'manrope.css'),css);
  for(const url of new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1]))) {const result=await fetch(url);if(!result.ok)throw new Error('Font unavailable');fs.writeFileSync(path.join(dir,path.basename(new URL(url).pathname)),Buffer.from(await result.arrayBuffer()));}
  console.log('Cached original Nexus Poppins and Manrope fonts for visual tests.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
