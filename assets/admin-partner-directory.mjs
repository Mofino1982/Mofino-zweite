import * as apps from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import * as auths from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import * as fs from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {WORLDS,publicProjection} from './partner-policy.mjs';

const app=apps.getApps().find(a=>a.name==='[DEFAULT]')||apps.initializeApp({apiKey:'AIzaSyDybfM0XPrpohdWvZF8X8xgP3mdCo6OuzI',authDomain:'mo-fino.firebaseapp.com',projectId:'mo-fino',appId:'1:279668714255:web:6ca341d3d6e3a472d5ec7a'});
const auth=auths.getAuth(app),db=fs.getFirestore(app),panel=document.getElementById('directPartnerApproval'),form=document.getElementById('directPartnerForm'),status=document.getElementById('directPartnerStatus');
const area=form.elements.world,branch=form.elements.branch;let allowed='',generation=0,stop=()=>{},busy=false;
for(const world of WORLDS)area.append(new Option(world.name,world.id));
function branches(){branch.replaceChildren();for(const name of WORLDS.find(world=>world.id===area.value).branches)branch.append(new Option(name,name));}
area.addEventListener('change',branches);branches();
async function imageData(){
  const file=form.elements.logo.files[0];if(!file)return {};
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>140000)throw Error('Bitte ein PNG-, JPEG- oder WebP-Logo mit höchstens 140 KB auswählen.');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Logo konnte nicht gelesen werden.'));reader.readAsDataURL(file);});
  return {logoData:data,logoAlt:'Logo '+form.elements.companyName.value.trim()};
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;if(!allowed||auth.currentUser?.uid!==allowed){status.textContent='Bitte mit deinem freigegebenen Admin-Konto anmelden.';return;}
  busy=true;form.querySelector('button[type=submit]').disabled=true;
  try{
    const uid=allowed,branding=await imageData(),data=publicProjection({company:{name:form.elements.companyName.value,address:form.elements.address.value},category:area.value,branch:branch.value,active:true,branding,uid,stamp:fs.serverTimestamp()});
    if(auth.currentUser?.uid!==uid||allowed!==uid)throw Error('Sitzung geändert. Bitte neu anmelden.');
    await fs.setDoc(fs.doc(fs.collection(db,'publicPartners')),data);
    form.reset();branches();status.textContent='Partner freigegeben. Firma und Kategorie erscheinen automatisch bei angemeldeten Kunden.';
  }catch(error){status.textContent=error.code==='permission-denied'?'Speichern nicht erlaubt. Bitte Adminfreigabe und die aktualisierten Datenbankregeln prüfen.':error.message||'Partner konnte nicht freigegeben werden.';}
  finally{busy=false;form.querySelector('button[type=submit]').disabled=false;}
});
auths.onAuthStateChanged(auth,async user=>{
  const run=++generation;allowed='';stop();stop=()=>{};panel.hidden=true;document.getElementById('directPartnerRecords').replaceChildren();
  if(!user?.emailVerified)return;
  try{
    const role=await fs.getDoc(fs.doc(db,'admins',user.uid));
    if(run!==generation||!role.exists()||role.data().active!==true)return;
    allowed=user.uid;panel.hidden=false;
    stop=fs.onSnapshot(fs.collection(db,'publicPartners'),snapshot=>{
      if(run!==generation)return;const list=document.getElementById('directPartnerRecords');list.replaceChildren();
      for(const doc of snapshot.docs){
        const record=doc.data(),row=document.createElement('article'),name=document.createElement('strong'),state=document.createElement('p'),button=document.createElement('button');
        name.textContent=record.name;state.textContent=(record.branch||record.category)+' · '+(record.active?'freigegeben':'ausgeblendet');button.type='button';button.textContent=record.active?'Im Kundenbereich ausblenden':'Im Kundenbereich anzeigen';
        button.onclick=async()=>{button.disabled=true;try{if(allowed!==auth.currentUser?.uid)throw Error('Sitzung geändert.');await fs.updateDoc(doc.ref,{active:!record.active,updatedAt:fs.serverTimestamp(),updatedBy:allowed});}catch(error){status.textContent=error.message||'Status konnte nicht geändert werden.';button.disabled=false;}};
        row.append(name,state,button);list.append(row);
      }
    },()=>{if(run===generation)status.textContent='Partnerliste konnte nicht geladen werden.';});
  }catch{if(run===generation)status.textContent='Adminzugang konnte nicht geprüft werden.';}
});
