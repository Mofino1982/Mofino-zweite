import {auth,db,functions} from './firebase-client.mjs';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import {collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {httpsCallable} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js';
import {getPaymentState,watchPaymentState} from './payment-readiness.mjs';
import {canPurchase,purchaseLabel} from './payment-state.mjs';
const status=document.getElementById('moStripeStatus');
let working=false,coffeeCompany='',payment;
const controls=[];
function say(text){if(status)status.textContent=text;for(const node of document.querySelectorAll('[data-stripe-feedback]'))node.textContent=text;}
function failure(e){return ['functions/not-found','functions/unavailable','functions/internal'].includes(e?.code)?'Zahlungen werden noch vorbereitet. Bitte später erneut versuchen.':e?.message||'Zahlung konnte nicht gestartet werden.';}
function refreshControls(){for(const c of controls){c.button.disabled=working||!c.terms?.checked||!canPurchase(payment||{},'coffee');const label=purchaseLabel(payment||{},'coffee');if(c.button.textContent!==label)c.button.textContent=label;}
 for(const button of document.querySelectorAll('#offers button')){
  if(button.textContent==='Mit Stripe abonnieren')button.dataset.moWashCheckout='true';
  if(button.dataset.moWashCheckout!=='true')continue;
  button.disabled=working||!canPurchase(payment||{},'carwash');const label=purchaseLabel(payment||{},'carwash');if(button.textContent!==label)button.textContent=label;
 }
}
watchPaymentState(value=>{payment=value;refreshControls();if(!value.enabled)say('Zahlungen werden vorbereitet. Angebote und Preise kannst du bereits ansehen.');else if(value.mode==='test')say('Stripe-Testmodus: keine echte Zahlung und kein echtes Einlöseguthaben.');else say('Sicherer Stripe-Checkout. Guthaben wird nach bestätigter Zahlung freigeschaltet.');});

if(document.querySelector('[data-coffee-checkout],#moStripePay,#moStripeMemberPay')){
 const host=document.createElement('section');host.className='card';const label=document.createElement('label');label.textContent='Dein gebuchter Café-Partner';const select=document.createElement('select');select.className='field';select.setAttribute('aria-label','Gebuchter Café-Partner');const empty=new Option('Bitte Partner wählen','');select.append(empty);label.append(select);host.append(label);document.querySelector('[data-coffee-checkout],#moStripePay,#moStripeMemberPay').before(host);
 select.onchange=()=>{coffeeCompany=select.value;};
 onAuthStateChanged(auth,async user=>{coffeeCompany='';select.replaceChildren(empty);if(!user?.emailVerified)return;try{const snap=await getDocs(query(collection(db,'publicPartners'),where('active','==',true)));if(auth.currentUser?.uid!==user.uid)return;for(const doc of snap.docs){if(!doc.id.startsWith('coffee__')||doc.data().category!=='coffee')continue;const id=doc.id.slice(8);if(/^[A-Za-z0-9_-]{1,100}$/.test(id))select.append(new Option(doc.data().name,id));}const desired=new URLSearchParams(location.search).get('firma');if([...select.options].some(o=>o.value===desired)){select.value=desired;coffeeCompany=desired;}}catch{say('Café-Partner konnten nicht geladen werden. Bitte später erneut versuchen.');}});
}
window.moStripeCheckout=async data=>{
 if(working)return;
 const user=auth.currentUser;if(!user?.emailVerified)throw Error('Bitte zuerst mit deinem bestätigten Kundenkonto anmelden.');
 const available=await getPaymentState(true),kind=data.catalogOfferId?'catalog':data.category;
 if(!canPurchase(available,kind))throw Error('Zahlungen werden für diesen Bereich noch vorbereitet.');
 if(data.category==='coffee'&&!data.catalogOfferId&&!coffeeCompany)throw Error('Bitte zuerst den gebuchten Café-Partner auswählen.');
 working=true;refreshControls();say(available.mode==='test'?'Stripe-Testzahlung wird geöffnet …':'Sicherer Stripe-Checkout wird geöffnet …');
 try{const result=(await httpsCallable(functions,'createStripeCheckout')({...data,...(data.category==='coffee'&&!data.catalogOfferId?{companyId:coffeeCompany}:{}),termsAccepted:true})).data;if(auth.currentUser?.uid!==user.uid)throw Error('Bitte erneut anmelden.');const url=new URL(result.url);if(url.origin!=='https://checkout.stripe.com'||url.username||url.password)throw Error('Ungültige Zahlungsadresse.');location.assign(url.href);}catch(e){say(failure(e));throw e;}finally{working=false;refreshControls();}
};
function bind(button,terms,plan){if(!button||!terms)return;controls.push({button,terms});terms.addEventListener('change',refreshControls);button.onclick=async()=>{if(button.disabled)return;try{await window.moStripeCheckout({category:'coffee',plan:typeof plan==='function'?plan():plan});}catch(e){say(failure(e));}};}
for(const [buttonId,termsId,selector] of [['moStripePay','moStripeTerms','input[name="club-plan"]:checked'],['moStripeMemberPay','moStripeMemberTerms','#requestedPlan']])bind(document.getElementById(buttonId),document.getElementById(termsId),()=>document.querySelector(selector)?.value);
for(const button of document.querySelectorAll('[data-coffee-checkout]'))bind(button,document.getElementById(button.dataset.termsId),button.dataset.coffeeCheckout);
for(const button of document.querySelectorAll('[data-wash-test-plan]'))button.hidden=true;
refreshControls();
new MutationObserver(refreshControls).observe(document.body,{childList:true,subtree:true});
document.getElementById('moStripePortal')?.addEventListener('click',async()=>{try{const category=document.getElementById('moStripeCategory')?.value||'coffee';const result=(await httpsCallable(functions,'createStripePortal')({category})).data;const url=new URL(result.url);if(url.origin!=='https://billing.stripe.com')throw Error('Ungültige Verwaltungsadresse.');location.assign(url.href);}catch(e){say(failure(e));}});
if(document.getElementById('moStripeResult')){
 const category=new URLSearchParams(location.search).get('bereich');let generation=0;
 onAuthStateChanged(auth,async user=>{const run=++generation;if(!user?.emailVerified){say('Bitte zuerst anmelden, um den Zahlungsstatus zu prüfen.');return;}
  const check=async attempt=>{if(run!==generation)return;try{const result=(await httpsCallable(functions,'getStripeStatus')({category})).data;if(run!==generation)return;if(result.active){document.getElementById('moStripeResult').href='member.html';document.getElementById('moStripeResult').hidden=false;say('Zahlung bestätigt. Dein Guthaben findest du im Kundenbereich.');return;}if(result.testPaid){say('Testzahlung bestätigt. Es wurde kein echtes Einlöseguthaben erzeugt.');return;}if(new URLSearchParams(location.search).has('cancelled')){say('Checkout verlassen. Es wurde kein Guthaben freigeschaltet.');return;}say('Wir warten auf die bestätigte Zahlung.');if(attempt<30)setTimeout(()=>check(attempt+1),2000);}catch(e){if(run===generation)say(failure(e));}};
  check(0);
 });
}
