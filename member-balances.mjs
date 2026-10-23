import * as apps from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import * as auths from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import * as fs from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import * as funcs from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js';
const app=apps.getApps().find(a=>a.name==='[DEFAULT]'),auth=auths.getAuth(app),db=fs.getFirestore(app),functions=funcs.getFunctions(app,'europe-west3');
const grid=document.getElementById('memberBalanceGrid'),status=document.getElementById('memberBalanceStatus');
let stop=()=>{},watching='',generation=0,records=[];
function el(tag,value,cls){const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n}
function berlinDay(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function render(){grid.replaceChildren();let count=0;
 for(const data of records){if(data.paymentMode!=='live'||data.active!==true||!data.invoiceId)continue;count++;
  const card=el('article','','balance-card');card.append(el('span','Bezahlt · '+(data.validUntil?.toMillis()>Date.now()?'aktiv':'abgelaufen'),'paid'),el('h3',data.companyName),el('p',data.offerName));
  let remaining=data.remaining;if(data.plan==='mittag')remaining=data.lastUseDay===berlinDay()&&data.dailyUsed>0?0:1;
  const value=el('div',data.plan==='cowork'?'Nach Tarif':String(remaining),'balance-value');value.append(el('span',data.plan==='mittag'?'Tagesgetränk übrig':data.plan==='cowork'?'Während der hinterlegten Öffnungszeiten':data.unit+' übrig'));card.append(value);
  if(data.units>0){const bar=document.createElement('progress');bar.max=data.units;bar.value=data.remaining;bar.setAttribute('aria-label',data.remaining+' von '+data.units+' '+data.unit);card.append(bar,el('p',data.units-data.remaining+' bereits eingelöst','used'));}
  if(data.validUntil?.toDate)card.append(el('p','Gültig bis '+data.validUntil.toDate().toLocaleDateString('de-DE')));
  if(data.plan==='mittag')card.append(el('p','1 Getränk pro Werktag, Montag bis Freitag 12–14 Uhr.'));
  const portal=el('button','Abo verwalten','member-offers');portal.type='button';portal.onclick=async()=>{portal.disabled=true;try{const r=await funcs.httpsCallable(functions,'createPartnerSubscriptionPortal')({subscriptionId:data.id});const u=new URL(r.data.url);if(u.origin!=='https://billing.stripe.com')throw Error();location.assign(u.href)}catch{status.textContent='Die Aboverwaltung ist gerade nicht erreichbar.'}finally{portal.disabled=false}};card.append(portal);grid.append(card);
 }
 status.textContent=count?'Restguthaben wird nach jeder bestätigten Einlösung automatisch aktualisiert.':'Noch kein bezahltes Abo vorhanden. Wähle unten einen freigegebenen Partner.';
}
function sync(){const user=auth.currentUser,ready=user?.emailVerified&&document.documentElement.hasAttribute('data-platform-ready');if(ready&&watching===user.uid)return;const run=++generation;stop();stop=()=>{};watching='';records=[];grid.replaceChildren();if(!ready){status.textContent='Nach deiner Anmeldung werden deine bezahlten Abos geladen.';return;}watching=user.uid;
 stop=fs.onSnapshot(fs.query(fs.collection(db,'paidSubscriptions'),fs.where('customerUid','==',user.uid)),snap=>{if(run!==generation)return;const changed=snap.docChanges().some(c=>c.type==='modified');records=snap.docs.map(d=>({...d.data(),id:d.id}));render();if(changed)window.dispatchEvent(new Event('mo-credit-updated'));},()=>{if(run!==generation)return;records=[];grid.replaceChildren();status.textContent='Guthaben konnte nicht geladen werden. Bitte Verbindung und Einrichtung prüfen.';});
}
auths.onAuthStateChanged(auth,sync);new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-platform-ready']});
setInterval(()=>{if(watching)render()},30000);
