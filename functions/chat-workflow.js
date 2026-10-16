"use strict";
const terminal = task => ["completed", "cancelled"].includes(task.status);
function checklist(value, fail) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) fail("Use up to 20 checklist steps.");
  const ids = new Set();
  return value.map(step => {
    if (!step || typeof step.id !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(step.id) || ids.has(step.id)) fail("Checklist step identifiers must be unique.");
    if (typeof step.text !== "string" || !step.text.trim() || step.text.length > 160 || typeof step.done !== "boolean") fail("Each checklist step needs a description and completion state.");
    ids.add(step.id); return {id:step.id,text:step.text.trim(),done:step.done};
  });
}
function progress(task, input, manage, fail) {
  const steps = input.checklist === undefined ? task.checklist || [] : checklist(input.checklist, fail);
  if (!manage && JSON.stringify(steps.map(({id,text})=>({id,text}))) !== JSON.stringify((task.checklist || []).map(({id,text})=>({id,text})))) fail("Only the task manager can change checklist steps.", "permission-denied");
  const requireNote = input.requireCompletionNote === undefined ? task.requireCompletionNote === true : input.requireCompletionNote;
  if (typeof requireNote !== "boolean" || (!manage && requireNote !== (task.requireCompletionNote === true))) fail("Only the task manager can change completion requirements.", "permission-denied");
  if (input.status === "completed" && steps.some(s=>!s.done)) fail("Finish all checklist steps before completing this task.", "failed-precondition");
  if ((input.status === "blocked" || (input.status === "completed" && requireNote)) && !input.progressNote?.trim()) fail(input.status === "blocked" ? "Explain why this task is blocked." : "Add a completion note.", "failed-precondition");
  return {checklist:steps,requireCompletionNote:requireNote};
}
function selectTasks(tasks, filters, today, fail) {
  const f=filters || {};
  if (!f || Array.isArray(f) || typeof f !== "object" || Object.keys(f).some(k=>!["status","due","priority","query"].includes(k))) fail("Invalid task filters.");
  if (f.status && !["all","active","open","in-progress","blocked","completed","cancelled"].includes(f.status)) fail("Invalid task status filter.");
  if (f.due && !["all","today","overdue","upcoming","none"].includes(f.due)) fail("Invalid task due-date filter.");
  if (f.priority && !["all","low","normal","high"].includes(f.priority)) fail("Invalid task priority filter.");
  if (f.query && (typeof f.query !== "string" || f.query.length>160)) fail("Task search is too long.");
  return tasks.filter(t=>(!f.status || f.status==="all" || (f.status==="active" ? !terminal(t) : t.status===f.status))
    && (!f.priority || f.priority==="all" || t.priority===f.priority)
    && (!f.query || [t.title,t.store,t.product,t.assigneeName].join(" ").toLowerCase().includes(f.query.toLowerCase()))
    && (!f.due || f.due==="all" || (f.due==="none" ? !t.dueDate : !terminal(t) && t.dueDate && (f.due==="today" ? t.dueDate===today : f.due==="overdue" ? t.dueDate<today : t.dueDate>today))));
}
function counts(tasks,today) { return {active:tasks.filter(t=>!terminal(t)).length,overdue:tasks.filter(t=>!terminal(t)&&t.dueDate&&t.dueDate<today).length,today:tasks.filter(t=>!terminal(t)&&t.dueDate===today).length,blocked:tasks.filter(t=>t.status==="blocked").length}; }
module.exports={checklist,progress,selectTasks,counts,terminal};
