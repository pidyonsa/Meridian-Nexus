'use strict';
const fs=require('node:fs'),path=require('node:path');
for(const name of ['order-workbook.cjs','package.json','package-lock.json'])fs.copyFileSync(path.resolve(__dirname,'../backend',name),path.resolve(__dirname,'../refresh',name));
console.log('Built isolated order publisher with the existing validated workbook parser.');
