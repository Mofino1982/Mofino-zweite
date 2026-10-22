
(()=>{
const companyRequestRecipient="tangosteakhouse1@web.de";
const root=document.getElementById('mo-firm-email-preview');
const form=root.querySelector('#mo-company-contact-form');
const area=root.querySelector('#mo-company-world');
const groups=Array.from(root.querySelectorAll('.mo-linked-branch'));
const review=root.querySelector('#mo-company-review');let reviewedFields=null;
function syncBranches(){for(const group of groups){const active=group.dataset.world===area.value;group.style.display=active?'grid':'none';const select=group.querySelector('select');select.disabled=!active;select.required=active;}}
area.addEventListener('change',syncBranches);area.addEventListener('input',syncBranches);window.addEventListener('pageshow',syncBranches);syncBranches();
root.querySelectorAll('[data-branch]').forEach(link=>link.addEventListener('click',()=>{
 const group=groups.find(group=>Array.from(group.querySelector('select').options).some(option=>option.value===link.dataset.branch));
 if(group){area.value=group.dataset.world;syncBranches();group.querySelector('select').value=link.dataset.branch;}
 form.hidden=false;review.hidden=true;
}));
form.addEventListener('submit',event=>{
 event.preventDefault();syncBranches();const dl=root.querySelector('#mo-company-review-data');dl.replaceChildren();const values=new FormData(form);values.set('Bereich',area.options[area.selectedIndex].textContent);
 for(const [name,value] of values){if(!String(value).trim())continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;dl.append(dt,dd);}
 reviewedFields=Array.from(values.entries());form.hidden=true;review.hidden=false;root.querySelector('#mo-email-preview-status').textContent='';review.scrollIntoView({behavior:'smooth',block:'start'});
});
root.querySelector('#mo-review-edit').addEventListener('click',()=>{review.hidden=true;form.hidden=false});
root.querySelector('#mo-review-send').addEventListener('click',()=>{
 const status=root.querySelector('#mo-email-preview-status');
 if(!reviewedFields){status.textContent='Bitte zuerst deine Angaben prüfen.';return;}
 const subject='MO-Partneranfrage: '+(reviewedFields.find(([key])=>key==='Firmenname')?.[1]||'Neuer Betrieb');
 const body='Guten Tag,\n\nich möchte meinen Betrieb bei Mo‘s Abo anmelden.\n\n'+reviewedFields.map(([key,value])=>key+': '+value).join('\n')+'\n\nBitte meldet euch bei mir. Vielen Dank.';
 location.href='mailto:'+encodeURIComponent(companyRequestRecipient)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
 status.textContent='Dein E-Mail-Programm wird geöffnet. Bitte sende die vorbereitete Anfrage dort ab. Falls sich nichts öffnet, richte zuerst ein E-Mail-Programm ein.';
});

})();
