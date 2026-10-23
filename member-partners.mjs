import * as apps from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import * as auths from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import * as fs from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {visibleWorlds} from './partner-policy.mjs';

const app=apps.getApps().find(a=>a.name==='[DEFAULT]')||apps.initializeApp({apiKey:'AIzaSyDybfM0XPrpohdWvZF8X8xgP3mdCo6OuzI',authDomain:'mo-fino.firebaseapp.com',projectId:'mo-fino',appId:'1:279668714255:web:6ca341d3d6e3a472d5ec7a'});
const auth=auths.getAuth(app),db=fs.getFirestore(app),status=document.getElementById('memberPartnerStatus'),categories=document.getElementById('memberCategories'),grid=document.getElementById('memberPartnerGrid');
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
let stop=()=>{},generation=0,watching='',records=[],selected='all';
function logo(record){
  const local=(window.moKnownCompanies||[]).find(p=>[p.name,...(p.aliases||[])].some(name=>name.trim().toLocaleLowerCase('de-DE')===record.name.trim().toLocaleLowerCase('de-DE')));
  const data=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(record.logoData||'')?record.logoData:null;
  const path=/^assets\/logos\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(local?.logoSrc||'')?local.logoSrc:null;
  if(!data&&!path)return el('span',record.name.split(/\s+/).slice(0,2).map(word=>word[0]).join(''),'member-logo-placeholder');
  const img=el('img');img.src=data||path;img.alt='Logo '+record.name;img.className='member-partner-logo';img.loading='lazy';return img;
}
function render(){
  const worlds=visibleWorlds(records);
  if(selected!=='all'&&!worlds.some(w=>w.id===selected))selected='all';
  categories.replaceChildren();grid.replaceChildren();
  if(!worlds.length){status.textContent='Noch keine Partner freigegeben. Hier erscheinen die Betriebe automatisch nach ihrer Freigabe.';return;}
  status.textContent=worlds.reduce((sum,w)=>sum+w.partners.length,0)+' freigegebene Partner · '+worlds.length+' verfügbare Bereiche';
  grid.classList.add('category-first-grid');
  for(const world of worlds){
    const section=el('details',undefined,'member-category-card'),summary=el('summary'),copy=el('div',undefined,'category-copy');
    const photo=el('img');photo.src='assets/mo-navigation/images/photos-'+world.id+'.jpg';photo.alt=world.name;photo.loading='lazy';photo.className='category-cover';
    copy.append(el('h3',world.name));
    const lines={food:'Für deinen ersten Kaffee. Und den schönsten Abend.',beauty:'Ein guter Moment, nur für dich.',travel:'Kurz mal weg. Lange davon zehren.',auto:'Gepflegt unterwegs. Entspannt ankommen.',shopping:'Lieblingsstücke für dich und dein Zuhause.',sport:'Mehr bewegen. Mehr gemeinsam erleben.',services:'Gute Unterstützung macht den Unterschied.',extras:'Manchmal macht das kleine Extra alles aus.'};
    copy.append(el('p',lines[world.id]||''),el('small',world.branches.join(' · ')),el('span','Partner entdecken ↗','category-open'));
    summary.append(photo,copy);section.append(summary);
    const panel=el('div',undefined,'category-partners');panel.append(el('h3','Partner · '+world.name));
    const cards=el('div',undefined,'member-partner-cards');
    for(const partner of world.partners){
      const card=el('article',undefined,'member-partner-card');card.append(logo(partner),el('span',partner.branch,'member-partner-branch'),el('h4',partner.name),el('p',partner.address||''),el('span','Freigegebener MO-Partner','member-approved'));
      const map=el('a','Standort ansehen ↗');map.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(partner.name+' '+partner.address);map.target='_blank';map.rel='noopener noreferrer';card.append(map);
      if(partner.category==='coffee'||partner.category==='carwash'){
        const link=el('a',partner.category==='coffee'?'Café-Angebote & Guthaben →':'Wasch-Angebote & Guthaben →','member-offers');link.href=partner.category==='coffee'?'cafe-kunden.html?firma='+encodeURIComponent(partner.id.replace(/^coffee__/,'')):'autowaschen-kunden.html';card.append(link);
      }
      const offers=el('a','Abos ansehen →','member-offers');offers.href='partner-angebote.html?partner='+encodeURIComponent(partner.id);card.append(offers);cards.append(card);
    }
    panel.append(cards);section.append(panel);grid.append(section);
  }
}
function sync(){
  const user=auth.currentUser,uid=user?.uid,ready=user?.emailVerified&&document.documentElement.hasAttribute('data-platform-ready');
  if(!ready){generation++;stop();stop=()=>{};watching='';records=[];selected='all';categories.replaceChildren();grid.replaceChildren();status.textContent='Nach der Anmeldung werden deine Partner geladen.';return;}
  if(watching===uid)return;stop();watching=uid;const run=++generation;status.textContent='Freigegebene Partner werden geladen …';
  stop=fs.onSnapshot(fs.query(fs.collection(db,'publicPartners'),fs.where('active','==',true)),snapshot=>{
    if(run!==generation||auth.currentUser?.uid!==uid)return;
    records=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));render();
  },()=>{if(run!==generation)return;records=[];categories.replaceChildren();grid.replaceChildren();status.textContent='Die Partner konnten nicht geladen werden. Bitte die Verbindung und die aktuellen Datenbankregeln prüfen.';});
}
auths.onAuthStateChanged(auth,sync);
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-platform-ready']});
