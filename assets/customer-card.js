import * as apps from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import * as auths from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import * as funcs from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js';
const app=apps.getApps().find(a=>a.name==='[DEFAULT]'),auth=auths.getAuth(app),functions=funcs.getFunctions(app,'europe-west3');
const box=document.getElementById('customerMemberQr'),code=document.getElementById('customerMemberId'),status=document.getElementById('customerCardStatus');
const refresh=document.createElement('button');refresh.type='button';refresh.textContent='QR-Code aktualisieren';refresh.className='member-offers';status.after(refresh);
let generation=0,timer,working=false,lastUid='';
function clear(){clearTimeout(timer);box.replaceChildren();code.textContent='';}
async function paint(){
 const user=auth.currentUser,uid=user?.uid;if(working)return;const run=++generation;clear();
 if(!user?.emailVerified||!document.documentElement.hasAttribute('data-platform-ready')){status.textContent='Bitte mit deinem Kundenkonto anmelden.';return;}
 if(document.hidden){status.textContent='Dein QR-Code wird beim Öffnen aktualisiert.';return;}
 working=true;refresh.disabled=true;lastUid=uid;status.textContent='Dein Einlösecode wird sicher erstellt …';
 try{const result=(await funcs.httpsCallable(functions,'createCustomerQr')({})).data;
  if(run!==generation||auth.currentUser?.uid!==uid||document.hidden)return;
  if(!/^MOSABO2:[a-f0-9]{32}$/.test(result.code)||!Number.isFinite(result.expiresAt)||result.expiresAt<=Date.now()||typeof window.qrcode!=='function')throw Error('QR-Code konnte nicht erstellt werden.');
  const qr=window.qrcode(0,'M');qr.addData(result.code);qr.make();const img=document.createElement('img');img.src=qr.createDataURL(6,4);img.alt='Dein kurzzeitig gültiger Einlösecode';img.width=230;img.height=230;box.append(img);
  code.textContent='Gültig bis '+new Date(result.expiresAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  status.textContent='Deine Firma sieht nur die bei ihr bezahlten Abos. Erst ihre Bestätigung zieht eine Einheit ab.';
  timer=setTimeout(paint,Math.max(1000,result.expiresAt-Date.now()-14000));
 }catch(e){if(run!==generation||auth.currentUser?.uid!==uid)return;clear();status.textContent=e.code==='functions/failed-precondition'?e.message:'Der Einlösecode ist noch nicht erreichbar. Bitte später aktualisieren oder den Betreiber informieren.';}
 finally{working=false;refresh.disabled=false;if(run!==generation&&!document.hidden&&auth.currentUser?.emailVerified)setTimeout(paint,0);}
}
refresh.onclick=paint;
auths.onAuthStateChanged(auth,()=>{generation++;working=false;lastUid='';clear();paint();});
new MutationObserver(()=>{if(document.documentElement.hasAttribute('data-platform-ready'))paint();else{generation++;clear();}}).observe(document.documentElement,{attributes:true,attributeFilter:['data-platform-ready']});
document.addEventListener('visibilitychange',()=>{generation++;clear();if(!document.hidden)paint();});
window.addEventListener('mo-credit-updated',()=>{if(lastUid===auth.currentUser?.uid)paint();});
