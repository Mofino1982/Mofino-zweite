export const WORLDS = [
  {id:'food',name:'Essen & Trinken',branches:['Cafés','Restaurants','Bäckereien','Bars']},
  {id:'beauty',name:'Beauty & Wellness',branches:['Friseure','Nagelstudios','Kosmetik','Massage']},
  {id:'travel',name:'Reisen & Übernachten',branches:['Hotels','Ferienwohnungen','Reisebüros']},
  {id:'auto',name:'Auto & Mobilität',branches:['Autowäsche','Werkstätten','Mietwagen']},
  {id:'shopping',name:'Shopping',branches:['Mode','Schmuck','Elektronik','Einrichtung']},
  {id:'sport',name:'Sport & Freizeit',branches:['Fitness','Yoga','Kino','Bowling']},
  {id:'services',name:'Dienstleistungen',branches:['Reinigung','Handwerker','Fotografie']},
  {id:'extras',name:'Weitere Vorteile',branches:['Bildung','Haustiere','Events','Geschenke']}
];
const aliases={coffee:['food','Cafés'],restaurant:['food','Restaurants'],carwash:['auto','Autowäsche'],bowling:['sport','Bowling']};
export function placement(record){
  const alias=aliases[record.category];
  const world=WORLDS.find(w=>w.id===(alias?.[0]||record.category));
  if(!world)return null;
  const branch=world.branches.includes(record.branch)?record.branch:(alias?.[1]||world.branches[0]);
  return {world,branch};
}
export function visiblePartners(records){
  return records.filter(p=>p.active===true&&typeof p.name==='string'&&p.name.trim()&&placement(p)).map(p=>({...p,...placement(p)}));
}
export function visibleWorlds(records){
  const partners=visiblePartners(records);
  return WORLDS.map(w=>({...w,partners:partners.filter(p=>p.world.id===w.id)})).filter(w=>w.partners.length);
}
export function publicProjection({company,category,branch,active,branding,previous,uid,stamp}){
  if(!active&&!previous)return null;
  const position=placement({category,branch});
  if(!position)throw Error('Bitte einen der acht MO-Bereiche auswählen.');
  if(branch&&!position.world.branches.includes(branch))throw Error('Die Branche passt nicht zum gewählten Bereich.');
  const name=String(company.name||company.cafeName||previous?.name||'').trim();
  const address=String(company.address||previous?.address||'').trim();
  if(!name||name.length>120||!address||address.length>250)throw Error('Bitte Firmenname und öffentliche Anschrift vervollständigen, bevor die Firma freigegeben wird.');
  const result={name,address,category,branch:position.branch,active:!!active,updatedAt:stamp,updatedBy:uid};
  const logo=branding?.logoData?branding:previous;
  if(logo?.logoData&&logo.logoData.length<=200000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo.logoData)){
    result.logoData=logo.logoData;result.logoAlt=String(logo.logoAlt||'Firmenlogo '+name).slice(0,160);
  }
  return result;
}
