import * as apps from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import * as auths from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import * as fs from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {catalogWorlds} from './partner-policy.mjs?v=katalog-2';
const app=apps.getApps().find(a=>a.name==='[DEFAULT]')||apps.initializeApp({apiKey:'AIzaSyDybfM0XPrpohdWvZF8X8xgP3mdCo6OuzI',authDomain:'mo-fino.firebaseapp.com',projectId:'mo-fino',appId:'1:279668714255:web:6ca341d3d6e3a472d5ec7a'});
const auth=auths.getAuth(app),db=fs.getFirestore(app),status=document.getElementById('memberPartnerStatus'),categories=document.getElementById('memberCategories'),grid=document.getElementById('memberPartnerGrid');
const photos=new Map([...grid.querySelectorAll('[data-world]')].map(card=>[card.dataset.world,card.querySelector('img')?.getAttribute('src')]));
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const lines={food:'Café-Abos ab 10 € / Monat · Kaffee, Genuss und mehr.',beauty:'Ein guter Moment, nur für dich.',travel:'Kurz mal weg. Lange davon zehren.',auto:'Gepflegt unterwegs. Entspannt ankommen.',shopping:'Lieblingsstücke für dich und dein Zuhause.',sport:'Mehr bewegen. Mehr gemeinsam erleben.',services:'Gute Unterstützung macht den Unterschied.',extras:'Manchmal macht das kleine Extra alles aus.'};
let stop=()=>{},generation=0,watching='',records=[];
function render(){
 const worlds=catalogWorlds(records);categories.replaceChildren();grid.replaceChildren();grid.classList.add('category-first-grid');
 status.textContent='Wähle eine Kategorie. Auf der nächsten Seite findest du die Partner und ihre Abos.';
 for(const world of worlds){
  const card=el('a',undefined,'member-category-card member-category-link');card.href='partner-angebote.html?bereich='+encodeURIComponent(world.id);card.dataset.world=world.id;
  const photo=el('img');photo.src=photos.get(world.id)||'assets/mo-navigation/images/photos-'+world.id+'.jpg';photo.alt=world.name;photo.className='category-cover';photo.loading='lazy';
  const copy=el('div',undefined,'category-copy');copy.append(el('h3',world.name),el('p',lines[world.id]),el('small',world.branches.join(' · ')),el('span','Partner & Abos ansehen →','category-open'));card.append(photo,copy);grid.append(card);
 }
}
function sync(){
 const user=auth.currentUser,uid=user?.uid,ready=user?.emailVerified&&document.documentElement.hasAttribute('data-platform-ready');
 if(!ready){generation++;stop();stop=()=>{};watching='';records=[];categories.replaceChildren();grid.replaceChildren();return;}
 if(watching===uid)return;stop();watching=uid;const run=++generation;render();
 stop=fs.onSnapshot(fs.query(fs.collection(db,'publicPartners'),fs.where('active','==',true)),snapshot=>{
  if(run!==generation||auth.currentUser?.uid!==uid)return;records=snapshot.docs.map(d=>({...d.data(),id:d.id}));render();
 },()=>{if(run!==generation)return;records=[];render();status.textContent='Wähle eine Kategorie. Die aktuellen Partner werden auf der nächsten Seite geladen.';});
}
auths.onAuthStateChanged(auth,sync);
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-platform-ready']});
