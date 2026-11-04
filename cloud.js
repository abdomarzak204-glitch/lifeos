// Only a public Supabase publishable/anon key belongs in configuration.
import {publicConfig} from './public-config.js?v=essentials8';
export function configuration(){try{return JSON.parse(localStorage.getItem('lifeos-cloud-config')||'null')||publicConfig;}catch{return publicConfig;}}
export function configure(url,key){const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||!key)throw Error('URL Supabase HTTPS et clé publique requises.');if(key.startsWith('sb_secret_'))throw Error('Utilise uniquement la clé publique publishable, jamais une clé secrète.');if(key.startsWith('eyJ')){try{const p=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(p.role!=='anon')throw Error();}catch{throw Error('Cette clé ne semble pas être une clé publique anon.');}}localStorage.setItem('lifeos-cloud-config',JSON.stringify({url:u.origin,key}));sessionStorage.removeItem('lifeos-session');localStorage.removeItem('lifeos-session');}
export function session(){try{const raw=localStorage.getItem('lifeos-session')||sessionStorage.getItem('lifeos-session');if(!raw)return null;const value=JSON.parse(raw);if(!value.access_token||!value.refresh_token)return null;localStorage.setItem('lifeos-session',raw);sessionStorage.removeItem('lifeos-session');return value;}catch{return null;}}
let refreshPromise=null;
function storeSession(value){const normalized={...value,expires_at:value.expires_at||Math.floor(Date.now()/1000)+(value.expires_in||3600)};localStorage.setItem('lifeos-session',JSON.stringify(normalized));return normalized;}
export function syncStatus(){return JSON.parse(localStorage.getItem('lifeos-sync-status')||'null');}
function reportSync(value){localStorage.setItem('lifeos-sync-status',JSON.stringify(value));window.dispatchEvent(new Event('lifeos-sync'));}
async function request(path,body,auth=true){const c=configuration();if(!c)throw Error('Service de partage non configuré.');let s=session();if(auth&&!s)throw Error('Connecte-toi pour continuer.');if(auth&&s.expires_at*1000<Date.now()+30000){if(!refreshPromise)refreshPromise=request('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh_token},false).then(storeSession).finally(()=>{refreshPromise=null;});s=await refreshPromise;}const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(c.url+path,{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+s.access_token}:{})},body:JSON.stringify(body),signal:controller.signal});const text=await r.text();const value=text?JSON.parse(text):null;if(!r.ok)throw Error(value?.msg||value?.message||value?.error_description||'Connexion impossible. Réessaie.');return value;}finally{clearTimeout(timeout);}}
export const sendCode=email=>request('/auth/v1/otp',{email,create_user:true},false);
export async function verifyCode(email,token){const r=await request('/auth/v1/verify',{email,token,type:'email'},false);storeSession(r);}
export async function signOut(){try{await request('/auth/v1/logout',{});}finally{sessionStorage.removeItem('lifeos-session');localStorage.removeItem('lifeos-session');}}
export async function rpc(name,args={}){try{const result=await request('/rest/v1/rpc/'+name,args);reportSync({at:new Date().toISOString(),ok:true});return result;}catch(error){reportSync({at:new Date().toISOString(),ok:false,message:error.message});throw error;}}
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function githubLogin(){
 const c=configuration();if(!c)throw Error('Configure le service avant de te connecter.');
 const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 sessionStorage.setItem('lifeos-pkce',JSON.stringify({verifier,created:Date.now()}));
 const redirect=new URL('./',location.href).href;
 const url=new URL(c.url+'/auth/v1/authorize');
 url.search=new URLSearchParams({provider:'github',redirect_to:redirect,code_challenge:challenge,code_challenge_method:'s256'}).toString();
 location.assign(url.href);
}
export async function finishLogin(){
 const url=new URL(location.href),code=url.searchParams.get('code'),error=url.searchParams.get('error_description');
 if(!code&&!error)return false;
 url.searchParams.delete('code');url.searchParams.delete('error');url.searchParams.delete('error_description');url.searchParams.delete('error_code');
 history.replaceState(null,'',url.pathname+url.search);
 const pending=JSON.parse(sessionStorage.getItem('lifeos-pkce')||'null');
 sessionStorage.removeItem('lifeos-pkce');
 if(error)throw Error(error);
 if(!pending||Date.now()-pending.created>600000)throw Error('Connexion expirée. Recommence depuis ce navigateur.');
 const r=await request('/auth/v1/token?grant_type=pkce',{auth_code:code,code_verifier:pending.verifier},false);
 if(!r.access_token||!r.refresh_token||!r.user)throw Error('Réponse de connexion invalide.');
 storeSession(r);
 return true;
}
