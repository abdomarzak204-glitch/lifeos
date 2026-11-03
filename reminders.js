import {day,addDay,occurrences,minutes} from './core.js';

export function inQuietHours(time,start,end){
 if(start===end)return false;
 return start<end?time>=start&&time<end:time>=start||time<end;
}

// Rebuild the entire future queue after every edit, deletion or postponement.
// Instants use the device's local timezone, matching the existing agenda.
export function reminderQueue(state,now=new Date(),days=14){
 const settings=state.settings.reminders;
 if(!settings?.enabled)return [];
 const queue=[],seen=new Set();
 for(let offset=0;offset<days;offset++){
  for(const activity of occurrences(state,addDay(day(now),offset))){
   if(activity.status||activity.reminder===false||settings.categories?.[activity.category]===false)continue;
   const lead=Number(activity.reminderMinutes??settings.beforeMinutes??10);
   if(!Number.isInteger(lead)||lead<0||lead>1440)continue;
   const at=new Date(activity.date+'T'+activity.start+':00');
   at.setMinutes(at.getMinutes()-lead);
   if(!Number.isFinite(at.getTime())||at<=now)continue;
   if(settings.quietEnabled&&inQuietHours(at.getHours()*60+at.getMinutes(),minutes(settings.quietStart||'22:00'),minutes(settings.quietEnd||'07:00')))continue;
   const id=activity.key+':'+at.toISOString();
   if(seen.has(id))continue;
   seen.add(id);
   queue.push({id,at:at.toISOString(),date:activity.date,key:activity.key,title:settings.showTitles?activity.title:'Ton activité va commencer',body:lead?`Dans ${lead} minutes`:'C’est le moment',url:'./?reminder='+encodeURIComponent(activity.key)+'&date='+activity.date});
  }
 }
 return queue.sort((a,b)=>a.at.localeCompare(b.at));
}
