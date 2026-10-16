"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const ExcelJS=require("../functions/node_modules/exceljs");
const h=require("./repair-attendance-september-weeks.cjs");
async function verify(){
  const fresh=h.read("fresh-source.json"),runs=h.read("live-runs.json"),later=h.read("recent-after-recovery.json");
  assert.ok(fresh.results.every(r=>r.status==="validated"));
  assert.ok(fresh.results.every(r=>r.sourceSharePoint.completeThrough>="2026-09-13"));
  const code=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8"),ctx=vm.createContext({Date,HttpsError:Error});
  for(const name of ["optionalText","optionalDate","attendanceCellValue","attendanceText","attendanceHeader","attendanceHeaderColumn","attendanceWorksheetHeader","attendanceWorksheet","salesforceDateValue","attendanceDateValue","attendanceBlueprintDayMatches","attendanceStoreCode","attendanceLocationCompliant","attendanceMonthKey","attendanceNumericValue","attendanceCalendarWeek"])vm.runInContext(h.fn(code,name),ctx);
  const sourceBook=new ExcelJS.Workbook(),book=new ExcelJS.Workbook();
  await sourceBook.xlsx.readFile(fresh.results[0].filePath);
  const workbookPath=path.join(fresh.downloadDir,"blueprint-before.xlsx");await book.xlsx.readFile(workbookPath);
  const source=ctx.attendanceWorksheet(sourceBook,{storeCode:["storecode"],employeeId:["employeeid"],visitDate:["visitdate"],checkIn:["checkinlocationcompliance"],checkOut:["checkoutlocationcompliance"]},"Fresh Salesforce report");
  const tuples=new Set(),counts=new Map(),fridayStores=new Set();
  let fridaySourceRows=0,fridayCompliantRows=0;
  for(let i=source.rowNumber+1;i<=source.worksheet.rowCount;i++){
    const row=source.worksheet.getRow(i),date=ctx.attendanceDateValue(row.getCell(source.columns.visitDate).value);
    if(date<"2026-09-01"||date>"2026-09-13")continue;
    if(date==="2026-09-11")fridaySourceRows++;
    if(!ctx.attendanceLocationCompliant(row.getCell(source.columns.checkIn).value)&&!ctx.attendanceLocationCompliant(row.getCell(source.columns.checkOut).value))continue;
    if(date==="2026-09-11")fridayCompliantRows++;
    const store=ctx.attendanceStoreCode(row.getCell(source.columns.storeCode).value),employee=ctx.attendanceText(row.getCell(source.columns.employeeId).value).replace(/\s+/g,"");
    if(!store||!employee)continue;
    if(date==="2026-09-11")fridayStores.add(store);
    const key=`${employee}|${store}|${date}`;if(tuples.has(key))continue;tuples.add(key);
    const weekKey=`${store}|${ctx.attendanceCalendarWeek(date)}`;counts.set(weekKey,(counts.get(weekKey)||0)+1);
  }
  const monthly=book.getWorksheet("South Africa Visit Plan"),daily=book.getWorksheet("Daily");
  const mismatches=[],totals={1:0,2:0},plannedFridayStores=new Set();
  let monthlyRows=0,dailyRows=0,dailyActual=0;
  monthly.eachRow((row,n)=>{
    if(n===1||ctx.attendanceMonthKey(row.getCell(1).value)!=="2026-09")return;
    const store=ctx.attendanceStoreCode(row.getCell(12).value);if(!store)return;monthlyRows++;
    for(const week of [1,2]){const expected=counts.get(`${store}|${week}`)||0,actual=ctx.attendanceNumericValue(row.getCell(33+week).value);totals[week]+=actual;if(expected!==actual)mismatches.push({sheet:monthly.name,row:n,week,expected,actual});}
  });
  daily.eachRow((row,n)=>{
    if(n===1||!ctx.attendanceBlueprintDayMatches(row.getCell(1).value,"2026-09-11"))return;
    const store=ctx.attendanceStoreCode(row.getCell(5).value),expected=fridayStores.has(store)?1:0,actual=ctx.attendanceNumericValue(row.getCell(34).value);
    dailyRows++;dailyActual+=actual;plannedFridayStores.add(store);
    if(expected!==actual)mismatches.push({sheet:daily.name,row:n,expected,actual});
  });
  const dailyRun=runs.runs.find(r=>r.id==="RSG3ryvgk53AgpQQoGqf"),monthlyRun=later.find(r=>r.id==="DDnaS5Q07PTbCz9WC9K5");
  assert.equal(dailyRun.status,"completed");assert.equal(monthlyRun.status,"completed");
  assert.equal(dailyRows,dailyRun.attendanceBlueprint.blueprintRowsForDate);assert.equal(dailyActual,dailyRun.attendanceBlueprint.actualOneRows);
  assert.deepEqual(totals,monthlyRun.attendanceBlueprint.monthlyPlan.actualWeekTotals);
  const result={verifiedAt:new Date().toISOString(),source:fresh.results[0].name,completeThrough:fresh.results[0].sourceSharePoint.completeThrough,
    friday:{date:"2026-09-11",sourceRows:fridaySourceRows,compliantSourceRows:fridayCompliantRows,plannedRows:dailyRows,actual:dailyActual,
      compliantVisitedStoresOutsideFridayPlan:[...fridayStores].filter(s=>!plannedFridayStores.has(s)).length,runId:dailyRun.id},
    monthly:{startDate:"2026-09-01",endDate:"2026-09-13",rows:monthlyRows,actualWeekTotals:totals,totalActual:totals[1]+totals[2],runId:monthlyRun.id},
    mismatchCount:mismatches.length,mismatches:mismatches.slice(0,20),workbook:JSON.parse(fs.readFileSync(path.join(fresh.downloadDir,"blueprint-before.json"),"utf8"))};
  h.save("completed-verification.json",result);assert.equal(mismatches.length,0,"Saved worksheet values differ from the fresh source");
  console.log(JSON.stringify(result,null,2));
}
async function task(){
  const result=h.read("completed-verification.json");assert.equal(result.mismatchCount,0);
  const api=await h.apiClient(),id="attendance-week-repair-20260914-jennifer",doc=await api(`meridianChatTasks/${id}`),task=h.decode(doc);
  if(["completed","cancelled"].includes(task.status)){console.log(`Jennifer's task is already ${task.status}; preserved.`);return;}
  assert.equal(task.assigneeUid,"fBGTRHhsk3hgjn50J8Sngm6fjDj2");
  const now=new Date(),note="Fresh 14 September 08:47 export processed and saved values independently verified. Friday 11 September: 337 attended across 444 planned rows. Latest Monthly through 13 September: Week 1 = 1,437; Week 2 = 2,283; total = 3,720. Zero source-to-workbook mismatches. Automatic Friday recovery and Jennifer's newer MTD run both completed; no duplicate run started. There are also 123 compliant visited store codes outside Friday's planned rows, available in the run exceptions for separate review. Jennifer: review Job summaries and close this task once satisfied.";
  const patch={status:"in-progress",progressNote:note,note,checklist:task.checklist.map((step,index)=>({...step,done:index<3?true:step.done})),revision:(task.revision||1)+1,updatedAt:now,
    history:[...(task.history||[]),{at:now.toISOString(),by:"Nexus maintenance",status:"in-progress",note:"Source block cleared. Automated updates and independent verification completed; awaiting Jennifer's final review."}],verifiedRunIds:[result.friday.runId,result.monthly.runId]};
  require("../functions/chat-workflow").checklist(patch.checklist,message=>{throw Error(message);});
  h.save("task-before-completion-update.json",doc);
  await api(h.base+":commit","POST",{writes:[{update:{name:doc.name,fields:h.fields(patch)},updateMask:{fieldPaths:Object.keys(patch)},currentDocument:{updateTime:doc.updateTime}}]});
  const updated=h.decode(await api(`meridianChatTasks/${id}`));assert.equal(updated.status,"in-progress");
  console.log(JSON.stringify({taskId:id,assignedTo:updated.assigneeName,status:updated.status,technicalChecksComplete:3,awaiting:"Jennifer final review"}));
}
(process.argv[2]==="task"?task():verify()).catch(e=>{console.error(e.message);process.exitCode=1;});
