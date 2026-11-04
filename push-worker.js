self.addEventListener('push',e=>{
 let data={};try{data=e.data?.json()||{};}catch{}
 const payload={title:String(data.title||'LifeOS').slice(0,160),body:String(data.body||'Un rappel pour toi.').slice(0,240),tag:String(data.tag||'lifeos').slice(0,250),url:String(data.url||'./')};
 e.waitUntil(Promise.all([
  self.registration.showNotification(payload.title,{body:payload.body,tag:payload.tag,icon:'./icon.svg',data:{url:payload.url},actions:[{action:'start',title:'▶ Commencer'},{action:'snooze',title:'⏰ Dans 10 min'},{action:'done',title:'✓ Terminé'}]}),
  caches.open('notification-history').then(async cache=>{
   const key=new URL('./notification-history.json',self.registration.scope).href;
   let history=[];try{history=await (await cache.match(key))?.json()||[];}catch{}
   history=[{...payload,receivedAt:new Date().toISOString()},...history.filter(x=>x.tag!==payload.tag)].slice(0,50);
   await cache.put(key,new Response(JSON.stringify(history),{headers:{'Content-Type':'application/json'}}));
  })
 ]));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 let target=new URL('./',self.registration.scope);
 try{const requested=new URL(e.notification.data?.url||'./',self.registration.scope);if(requested.origin===target.origin&&requested.pathname.startsWith(target.pathname))target=requested;}catch{}
 if(['start','snooze','done'].includes(e.action))target.searchParams.set('action',e.action);
 e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  for(const client of windows){if(new URL(client.url).pathname.startsWith(new URL(self.registration.scope).pathname)){await client.navigate(target.href);return client.focus();}}
  return clients.openWindow(target.href);
 }));
});
