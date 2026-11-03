import {configuration,session,rpc} from './cloud.js';
import {reminderQueue} from './reminders.js';
let busy=false,dirty=false;
const device=()=>{let id=localStorage.getItem('lifeos-device');if(!id){id=crypto.randomUUID();localStorage.setItem('lifeos-device',id);}return id;};
function decode(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));}
export function supported(){return 'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;}
async function enableNow(state){
 if(!supported())throw Error('Sur iPhone, ouvre LifeOS depuis son icône sur l’écran d’accueil (iOS 16.4 ou plus récent).');
 if(!session())throw Error('Connecte-toi dans Ensemble avant d’activer les rappels.');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error('Notifications non autorisées. Tu peux modifier ce choix dans les réglages de ton appareil.');
 const c=configuration();
 const response=await fetch(c.url+'/functions/v1/lifeos-push',{method:'POST',headers:{'Content-Type':'application/json',apikey:c.key},body:JSON.stringify({action:'config'}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Le service d’envoi n’est pas encore disponible. Aucun rappel distant activé.');
 const {publicKey}=await response.json();
 if(typeof publicKey!=='string'||!publicKey)throw Error('Configuration des notifications incomplète.');
 const registration=await navigator.serviceWorker.ready;
 let sub=await registration.pushManager.getSubscription();
 if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(publicKey)});
 const settings={...state.settings.reminders,enabled:true};
 await rpc('lifeos_push_sync',{p_device:device(),p_subscription:sub.toJSON(),p_jobs:reminderQueue({...state,settings:{...state.settings,reminders:settings}},new Date(),30)});
 state.settings.reminders=settings;
 localStorage.setItem('lifeos-push-synced',new Date().toISOString());
}
async function syncNow(state){
 if(!state.settings.reminders?.enabled)return;
 if(busy){dirty=true;return;}
 busy=true;
 try{
  do{
   dirty=false;
   if(!session())throw Error('Reconnecte-toi pour mettre à jour les rappels.');
   const sub=await (await navigator.serviceWorker.ready).pushManager.getSubscription();
   if(!sub)throw Error('Les notifications doivent être réactivées sur cet appareil.');
   await rpc('lifeos_push_sync',{p_device:device(),p_subscription:sub.toJSON(),p_jobs:reminderQueue(state,new Date(),30)});
   localStorage.setItem('lifeos-push-synced',new Date().toISOString());
  }while(dirty&&state.settings.reminders?.enabled);
 }finally{busy=false;}
}
async function disableNow(state){
 await rpc('lifeos_push_disable',{p_device:device()});
 const sub=await (await navigator.serviceWorker.ready).pushManager.getSubscription();
 if(sub)await sub.unsubscribe();
 state.settings.reminders={...state.settings.reminders,enabled:false};
}
export async function localTest(){
 if(!supported()||Notification.permission!=='granted')throw Error('Active les notifications avant le test.');
 await (await navigator.serviceWorker.ready).showNotification('LifeOS · Test sur cet appareil',{body:'Affichage local réussi. Ce test ne vérifie pas l’envoi par le serveur.',tag:'lifeos-local-test',data:{url:'./'}});
}

// Serialize device mutations so disabling cannot race an earlier sync.
let operation=Promise.resolve();
function enqueue(action){const next=operation.then(action);operation=next.catch(()=>{});return next;}
export const enable=state=>enqueue(()=>enableNow(state));
export const sync=state=>enqueue(()=>syncNow(state));
export const disable=state=>enqueue(()=>disableNow(state));
