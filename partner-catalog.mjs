import {auth,db} from './firebase-client.mjs';
import './checkout.mjs';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import {doc,getDoc,collection,query,where,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {watchPaymentState} from './payment-readiness.mjs';
import {canPurchase,purchaseLabel} from './payment-state.mjs';
const $=id=>document.getElementById(id),list=$('partnerOffers'),status=$('offerStatus'),id=new URLSearchParams(location.search).get('partner');
let generation=0,stop=()=>{},working=false,payment={},controls=[];
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n};
function ready(){for(const c of controls){c.button.disabled=working||!c.checkbox.checked||!canPurchase(payment,'catalog');c.button.textContent=purchaseLabel(payment,'catalog');}}
watchPaymentState(value=>{payment=value;ready();if(controls.length)status.textContent=!value.catalog?'Zahlungen werden vorbereitet. Du kannst die Angebote bereits ansehen.':value.mode==='test'?'Testmodus: keine echte Zahlung und kein echtes Einlöseguthaben.':'Wähle dein Abo. Dein Guthaben wird nach bestätigter Zahlung freigeschaltet.';});
onAuthStateChanged(auth,async user=>{
 const run=++generation;stop();list.replaceChildren();controls=[];$('partnerLogo').hidden=true;
 if(!user?.emailVerified){$('offerLogin').hidden=false;status.textContent='Bitte mit deinem bestätigten Kundenkonto anmelden.';return;}
 $('offerLogin').hidden=true;
 if(!/^[A-Za-z0-9_-]{1,180}$/.test(id||'')){status.textContent='Bitte zuerst einen Partner im Kundenbereich auswählen.';return;}
 try{
  const partner=await getDoc(doc(db,'publicPartners',id));if(run!==generation)return;
  if(!partner.exists()||partner.data().active!==true){status.textContent='Dieser Partner ist nicht freigegeben.';return;}
  const p=partner.data();$('offerTitle').textContent=p.name;$('partnerArea').textContent=p.branch||'';
  if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.logoData||'')){$('partnerLogo').src=p.logoData;$('partnerLogo').hidden=false;}
  stop=onSnapshot(query(collection(db,'subscriptionOffers'),where('partnerId','==',id),where('active','==',true)),snap=>{
   if(run!==generation)return;list.replaceChildren();controls=[];
   status.textContent=snap.empty?'Für diesen Partner wurde noch kein Abo veröffentlicht.':!payment.catalog?'Zahlungen werden vorbereitet. Du kannst die Angebote bereits ansehen.':payment.mode==='test'?'Testmodus: keine echte Zahlung und kein echtes Einlöseguthaben.':'Wähle dein Abo. Guthaben wird nach bestätigter Zahlung freigeschaltet.';
   for(const d of snap.docs){
    const o=d.data(),card=el('article','');card.className='offer-card';card.append(el('h2',o.name),el('p',o.units+' '+o.unit+' pro Monat'));
    const price=el('p',(o.priceCents/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'})+' / Monat');price.className='offer-price';card.append(price);
    const label=el('label',''),checkbox=document.createElement('input');checkbox.type='checkbox';label.append(checkbox,el('span','Ich möchte dieses monatliche Abo buchen und akzeptiere die Abo-Bedingungen.'));
    const terms=el('a','Abo-Bedingungen lesen');terms.href='agb.html';terms.target='_blank';terms.rel='noopener';const button=el('button','');controls.push({button,checkbox});checkbox.onchange=ready;
    button.onclick=async()=>{if(button.disabled)return;working=true;ready();try{await window.moStripeCheckout({category:o.category,catalogOfferId:d.id,termsAccepted:true});}catch(e){if(run===generation)status.textContent=e.message||'Zahlung konnte nicht gestartet werden.';}finally{working=false;ready();}};
    card.append(terms,label,button);list.append(card);
   }ready();
  },()=>{if(run===generation){list.replaceChildren();controls=[];status.textContent='Angebote konnten nicht geladen werden. Bitte später erneut versuchen.';}});
 }catch{if(run===generation)status.textContent='Partner konnte nicht geladen werden.';}
});
