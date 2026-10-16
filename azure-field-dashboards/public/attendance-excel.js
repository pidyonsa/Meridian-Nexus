(function(global) {
  'use strict';
  let promise;
  function load() {
    if(global.ExcelJS)return Promise.resolve(global.ExcelJS);
    if(!promise)promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='/vendor/exceljs.min.js';
      const failed=()=>{promise=null;script.remove();reject(Error('Excel export could not be loaded. Please retry.'));};
      script.onload=()=>global.ExcelJS?resolve(global.ExcelJS):failed();
      script.onerror=failed;document.head.append(script);
    });
    return promise;
  }
  global.AttendanceExcel={load};
})(typeof window==='undefined'?globalThis:window);
