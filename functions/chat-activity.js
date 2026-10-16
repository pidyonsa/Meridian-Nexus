"use strict";
const {terminal}=require("./chat-workflow");
const stamp=value=>value?.toMillis?.() || (typeof value === "string" ? Date.parse(value) : 0) || 0;
function buildActivity({db,canReadRoom}) {
  return async actor=>{
    const rooms=await db.collection("meridianChatRooms").where("memberIds","array-contains",actor.uid).get();
    const reads=await db.collection("meridianChatReads").doc(actor.uid).collection("rooms").get();
    const positions=new Map(reads.docs.map(d=>[d.id,d.data().sequence || 0]));
    const allowed=new Map(rooms.docs.filter(d=>canReadRoom(actor.profile,actor.uid,d.data())&&!d.data().archived).map(d=>[d.id,d]));
    let unreadChats=0;const events=[];
    // Receipts can lag, and own or deleted messages are not unread work. Scan
    // only candidate rooms, stopping at the first unread incoming message.
    for(const [roomId,doc] of allowed){
      const room=doc.data(),position=positions.get(roomId)||0;
      if(room.lastSequence<=position)continue;
      let cursor=null,found=null;
      do{
        let q=doc.ref.collection("messages").where("sequence",">",position).orderBy("sequence","desc").limit(100);
        if(cursor)q=q.startAfter(cursor);
        const page=await q.get();
        found=page.docs.find(d=>!d.data().removed&&d.data().senderUid!==actor.uid);
        cursor=!found&&page.size===100?page.docs.at(-1):null;
      }while(cursor);
      if(found){unreadChats++;events.push({id:`message_${found.id}`,kind:"message",roomId,at:stamp(found.data().createdAt)});}
    }
    const tasks=await db.collection("meridianChatTasks").where("assigneeUid","==",actor.uid).get();
    let activeTasks=0;
    for(const doc of tasks.docs){const task=doc.data();if(!allowed.has(task.roomId)||terminal(task))continue;activeTasks++;
      if(task.createdBy!==actor.uid||task.assignmentVersion>1)events.push({id:`assigned_${doc.id}_${task.assignmentVersion||1}`,kind:"task",roomId:task.roomId,taskId:doc.id,at:stamp(task.assignedAt||task.createdAt)});
      if(task.remindAt&&Date.parse(task.remindAt)<=Date.now())events.push({id:`task_${doc.id}_${task.reminderVersion||1}`,kind:"reminder",roomId:task.roomId,taskId:doc.id,at:Date.parse(task.remindAt)});
    }
    return {unreadChats,activeTasks,events:events.filter(e=>e.at>Date.now()-3600000).sort((a,b)=>b.at-a.at).slice(0,100)};
  };
}
module.exports={buildActivity};
