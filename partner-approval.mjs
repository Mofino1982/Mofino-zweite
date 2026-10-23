import {publicProjection} from './partner-policy.mjs';

// Prepare every read before the caller writes any approval documents.
export async function prepareCoffeePublication({fs,db,tx,id,kind,current,input,uid}){
  const active=kind==='cafeApplications'?input.decision==='approved':input.active===true;
  const cafeId=input.cafeId||current.cafeId;
  if(!cafeId)return [];
  const publicRef=fs.doc(db,'publicPartners','coffee__'+cafeId);
  const refs=[publicRef,fs.doc(db,'partnerBranding',id+'_coffee'),fs.doc(db,'cafes',cafeId),fs.doc(db,'cafeApplications',id)];
  const [published,branding,cafe,application]=await Promise.all(refs.map(ref=>tx.get(ref)));
  const company={name:input.cafeName||current.cafeName,address:(kind==='cafeApplications'?current.address:application.data()?.address)||cafe.data()?.address||''};
  const data=publicProjection({company,category:'coffee',branch:input.branch,active,branding:branding.data(),previous:published.data(),uid,stamp:fs.serverTimestamp()});
  const writes=data?[{ref:publicRef,data}]:[];
  if(kind==='staff'&&current.cafeId&&current.cafeId!==cafeId){
    const oldRef=fs.doc(db,'publicPartners','coffee__'+current.cafeId),old=await tx.get(oldRef);
    if(old.exists())writes.push({ref:oldRef,data:{...old.data(),active:false,updatedAt:fs.serverTimestamp(),updatedBy:uid}});
  }
  return writes;
}

export async function approveServicePartner({fs,db,category,id,active,status='approved',branch,uid}){
  await fs.runTransaction(db,async tx=>{
    const companyRef=fs.doc(db,'services',category,'companies',id),publicRef=fs.doc(db,'publicPartners',category+'__'+id);
    const [company,previous,branding]=await Promise.all([tx.get(companyRef),tx.get(publicRef),tx.get(fs.doc(db,'partnerBranding',id+'_'+category))]);
    if(!company.exists())throw Error('Die Firmenanmeldung existiert nicht mehr.');
    const data=publicProjection({company:company.data(),category,branch,active,branding:branding.data(),previous:previous.data(),uid,stamp:fs.serverTimestamp()});
    tx.update(companyRef,{active:!!active,status,reviewedAt:fs.serverTimestamp(),reviewedBy:uid});
    if(data)tx.set(publicRef,data);
  });
}
