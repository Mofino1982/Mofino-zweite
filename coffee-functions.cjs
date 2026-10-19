'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');const {initializeApp}=require('firebase-admin/app');const {getFirestore,FieldValue,Timestamp}=require('firebase-admin/firestore');const crypto=require('node:crypto');const {berlin,eligibility}=require('./logic.cjs');
initializeApp();const db=getFirestore(),options={region:'europe-west3',maxInstances:3};
function verified(req){if(!req.auth||req.auth.token.email_verified!==true)throw new HttpsError('unauthenticated','Bitte mit bestätigter E-Mail anmelden.');return req.auth.uid;}
function codeId(req){const code=req.data?.code;if(typeof code!=='string'||!/^MOFINO1:[a-f0-9]{32}$/.test(code))throw new HttpsError('invalid-argument','Ungültiger Mitgliedscode.');return code.slice(8);}
exports.createMemberCode=onCall(options,async req=>{const uid=verified(req);return db.runTransaction(async tx=>{const member=await tx.get(db.doc(`members/${uid}`));if(!member.exists||member.data().active!==true)throw new HttpsError('permission-denied','Keine aktive Mitgliedschaft.');const id=crypto.randomBytes(16).toString('hex'),expiresAt=Timestamp.fromMillis(Date.now()+120000);tx.create(db.doc(`memberCodes/${id}`),{memberUid:uid,expiresAt,createdAt:FieldValue.serverTimestamp()});return {code:'MOFINO1:'+id,expiresAt:expiresAt.toMillis()};});});
async function transact(req,commit){const staffUid=verified(req),id=codeId(req);return db.runTransaction(async tx=>{
 const now=new Date(),time=berlin(now),recordRef=db.doc(`redemptions/${id}`);
 const [staff,code,prior]=await tx.getAll(db.doc(`staff/${staffUid}`),db.doc(`memberCodes/${id}`),recordRef);
 const access=staff.data();if(!staff.exists||access.active!==true||typeof access.cafeId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(access.cafeId))throw new HttpsError('permission-denied','Kein aktiver Firmenzugang.');
 if(prior.exists){const old=prior.data();if(old.staffUid!==staffUid)throw new HttpsError('already-exists','Dieser Code wurde bereits eingelöst.');return {redeemed:true,duplicate:true,memberName:old.memberName,memberId:old.memberId,cafeName:old.cafeName,payoutCents:100};}
 if(!code.exists||code.data().expiresAt.toMillis()<=now.getTime())throw new HttpsError('failed-precondition','Code ist abgelaufen. Bitte einen neuen Code auf der Mitgliedskarte anzeigen.');
 const memberUid=code.data().memberUid;if(typeof memberUid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(memberUid))throw new HttpsError('failed-precondition','Ungültiger Mitgliedscode.');
 const memberRef=db.doc(`members/${memberUid}`),dayRef=db.doc(`members/${memberUid}/redemptionDays/${time.day}`);
 const [member,day,cafe]=await tx.getAll(memberRef,dayRef,db.doc(`cafes/${access.cafeId}`));if(!member.exists)throw new HttpsError('not-found','Mitglied nicht gefunden.');
 const data=member.data(),used=day.exists?day.data().used:0;if(!Number.isSafeInteger(used)||used<0)throw new HttpsError('failed-precondition','Tagesverbrauch nicht korrekt eingerichtet.');
 if(data.plan==='cowork'&&(!cafe.exists||cafe.data().active!==true))throw new HttpsError('failed-precondition','Café-Öffnungszeiten für Cowork fehlen.');
 const status=eligibility(data,used,now,cafe.data()?.hours);const response={...status,memberName:data.name||'Mitglied',memberId:data.memberId||'',cafeName:access.cafeName||access.cafeId,payoutCents:100};
 if(!commit)return response;if(!status.ok)throw new HttpsError('failed-precondition',status.reason);
 if(status.remaining!==null)tx.update(memberRef,{remaining:status.remaining-1});
 tx.set(dayRef,{used:used+1,updatedAt:FieldValue.serverTimestamp()},{merge:true});
 tx.create(recordRef,{memberUid,memberId:response.memberId,memberName:response.memberName,staffUid,cafeId:access.cafeId,cafeName:response.cafeName,plan:data.plan,day:time.day,month:time.month,quantity:1,payoutCents:100,createdAt:FieldValue.serverTimestamp()});
 return {...response,redeemed:true,duplicate:false,remaining:status.remaining===null?null:status.remaining-1};
 });}
exports.previewDrink=onCall(options,req=>transact(req,false));exports.redeemDrink=onCall(options,req=>transact(req,true));
