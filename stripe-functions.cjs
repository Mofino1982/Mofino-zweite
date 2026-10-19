'use strict';
const {onCall,onRequest,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret,defineString}=require('firebase-functions/params');
const {getFirestore,FieldValue,Timestamp}=require('firebase-admin/firestore');
const crypto=require('node:crypto');
const {COFFEE,WASH,verifyEvent,formFields,modeOf,invoiceSubscription,invoiceGrant}=require('./stripe-logic.cjs');
const KEY=defineSecret('STRIPE_SECRET_KEY'),SIGNING=defineSecret('STRIPE_WEBHOOK_SECRET');
const BASE=defineString('MO_PUBLIC_BASE_URL',{default:'https://mofino1982.github.io/Mofino-zweite/'});
const region='europe-west3',db=getFirestore(),stamp=()=>FieldValue.serverTimestamp();
const options={region,maxInstances:3,secrets:[KEY]};
function uid(req){if(!req.auth||req.auth.token.email_verified!==true)throw new HttpsError('unauthenticated','Bitte zuerst anmelden und die E-Mail bestätigen.');return req.auth.uid;}
function category(value){if(!['coffee','carwash'].includes(value))throw new HttpsError('invalid-argument','Ungültiger Bereich.');return value;}
function publicBase(){const url=new URL(BASE.value());if(url.protocol!=='https:'||url.search||url.hash)throw Error('MO_PUBLIC_BASE_URL muss eine HTTPS-Adresse mit abschließendem / sein.');if(!url.pathname.endsWith('/'))url.pathname+='/';return url.href;}
async function stripe(path,method='GET',data,key){const response=await fetch('https://api.stripe.com/v1/'+path,{method,headers:{Authorization:'Bearer '+KEY.value(),'Stripe-Version':'2025-06-30.basil',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},...(method==='POST'?{body:formFields(data)}:{}),signal:AbortSignal.timeout(20000)});const body=await response.json();if(!response.ok)throw new Error('Stripe-Anfrage fehlgeschlagen ('+response.status+').');return body;}
function entitlement(c,u){return db.doc(c==='coffee'?'members/'+u:'services/carwash/subscriptions/'+u);}
async function checkoutOffer(data){const c=category(data.category);if(c==='coffee'){const p=COFFEE[data.plan];if(!p)throw new HttpsError('invalid-argument','Bitte gültigen Café-Tarif wählen.');return {...p,category:c,plan:data.plan,offerId:data.plan,companyId:'',companyName:''};}
 const id=data.offerId;if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,180}$/.test(id))throw new HttpsError('invalid-argument','Bitte ein aktives Wasch-Angebot wählen.');
 const doc=await db.doc('services/carwash/offers/'+id).get();if(!doc.exists||doc.data().active!==true)throw new HttpsError('failed-precondition','Dieses Angebot ist nicht aktiv.');const o=doc.data(),plan=Object.keys(WASH).find(k=>id.endsWith('__'+k+'_v1')),p=WASH[plan];
 if(!p||o.priceCents!==p.priceCents||o.units!==p.units||o.payoutCents!==500)throw new HttpsError('failed-precondition','Nur die vereinbarten Basic-, Plus- und Premium-Tarife sind für Stripe eingerichtet.');
 const company=await db.doc('services/carwash/companies/'+o.companyId).get();if(!company.exists||company.data().active!==true)throw new HttpsError('failed-precondition','Der Betrieb ist nicht freigegeben.');
 return {...p,category:c,plan,offerId:id,companyId:o.companyId,companyName:company.data().name,payoutCents:500};
}
exports.createStripeCheckout=onCall(options,async req=>{
 const user=uid(req);if(req.data?.termsAccepted!==true)throw new HttpsError('failed-precondition','Bitte die Abo-Bedingungen bestätigen.');
 const settings=await db.doc('billingSettings/main').get(),cfg=settings.data(),mode=modeOf(KEY.value());
 if(!settings.exists||cfg.enabled!==true||cfg.mode!==mode||cfg.termsVersion!=='stripe-2026-10-19')throw new HttpsError('failed-precondition','Stripe wird noch eingerichtet. Bitte später erneut versuchen.');
 const offer=await checkoutOffer(req.data);if((offer.category==='coffee'&&cfg.coffeeEnabled!==true)||(offer.category==='carwash'&&cfg.washPartnerPricesConfirmed!==true))throw new HttpsError('failed-precondition','Dieser Bereich ist noch nicht für Stripe freigegeben.');
 const slot=db.doc('billingAccounts/'+user+'__'+offer.category),newId=crypto.randomUUID().replaceAll('-',''),base=publicBase();
 const selected=await db.runTransaction(async tx=>{const [account,sub,profile,loyalty]=await tx.getAll(slot,entitlement(offer.category,user),db.doc('platformProfiles/'+user),db.doc('services/carwash/loyaltyContracts/'+user));
  if(!profile.exists||profile.data().accountType!=='customer')throw new HttpsError('failed-precondition','Bitte ein kostenloses Kundenkonto anlegen.');
  const accountData=account.data();let old=null;if(accountData?.orderId){const snap=await tx.get(db.doc('billingOrders/'+accountData.orderId));old=snap.data();}
  if(old&&old.status==='pending'){if(old.offerId!==offer.offerId)throw new HttpsError('failed-precondition','Es ist bereits ein Checkout für einen anderen Tarif offen. Bitte diesen abschließen oder ablaufen lassen.');return old;}
  if(accountData?.subscriptionActive===true)throw new HttpsError('already-exists','Es besteht bereits ein Stripe-Abo. Bitte über „Abo verwalten“ ändern oder kündigen.');
  if(sub.exists&&sub.data().active===true&&(!sub.data().validUntil||sub.data().validUntil.toMillis()>Date.now()))throw new HttpsError('already-exists','Es besteht bereits ein freigeschaltetes Abo. Bitte zuerst mit dem Admin klären.');
  if(offer.category==='carwash'&&loyalty.exists)throw new HttpsError('failed-precondition','Es besteht bereits ein Bonusvertrag. Der Admin muss diesen zuerst für Stripe übernehmen; vorhandene Boni werden nicht überschrieben.');
  const order={...offer,planName:offer.name,id:newId,uid:user,email:req.auth.token.email,name:profile.data().name,mode,status:'pending',base,termsVersion:cfg.termsVersion,acceptedAt:stamp(),createdAt:stamp()};
  tx.create(db.doc('billingOrders/'+newId),order);tx.set(slot,{uid:user,category:offer.category,orderId:newId,subscriptionActive:false,updatedAt:stamp()});return order;
 });
 if(selected.mode!==mode)throw new HttpsError('failed-precondition','Test- und Live-Modus sind getrennt. Bitte zuerst die offene Testbestellung abschließen.');
 if(selected.sessionId){const previous=await stripe('checkout/sessions/'+selected.sessionId);if(previous.status==='open')return {url:previous.url};if(previous.status==='expired'){await db.doc('billingOrders/'+selected.id).update({status:'expired'});throw new HttpsError('aborted','Checkout ist abgelaufen. Bitte erneut auf Bezahlen klicken.');}throw new HttpsError('failed-precondition','Zahlung wird geprüft. Bitte den Zahlungsstatus öffnen.');}
 const payload={mode:'subscription',client_reference_id:user,customer_email:selected.email,payment_method_types:['card'],line_items:[{quantity:1,price_data:{currency:'eur',unit_amount:selected.priceCents,recurring:{interval:'month'},product_data:{name:'Mo‘s Abo · '+(selected.category==='coffee'?'Café':'Autowäsche')+' · '+selected.planName}}}],subscription_data:{metadata:{moOrderId:selected.id,moUid:user,moCategory:selected.category}},metadata:{moOrderId:selected.id},success_url:selected.base+'zahlung.html?bereich='+selected.category,cancel_url:selected.base+'zahlung.html?bereich='+selected.category+'&cancelled=1',consent_collection:{terms_of_service:'required'},allow_promotion_codes:false};
 // Same immutable order and idempotency key also recover an interrupted request.
 const session=await stripe('checkout/sessions','POST',payload,'mo-checkout-'+selected.id);
 if(session.livemode!==(mode==='live')||typeof session.url!=='string'||!session.url.startsWith('https://checkout.stripe.com/'))throw Error('Unerwartete Stripe-Antwort.');
 await db.doc('billingOrders/'+selected.id).update({sessionId:session.id,customerId:session.customer||'',updatedAt:stamp()});return {url:session.url};
});
async function paidInvoice(invoice){
 const subId=invoiceSubscription(invoice);if(!subId)return;const sub=await stripe('subscriptions/'+subId),orderId=sub.metadata?.moOrderId;if(!/^[a-f0-9]{32}$/.test(orderId||''))return;
 const ref=db.doc('billingOrders/'+orderId),snapshot=await ref.get();if(!snapshot.exists)return;const order={...snapshot.data(),id:orderId};
 if(sub.livemode!==(order.mode==='live')||invoice.livemode!==sub.livemode)throw Error('Test-/Live-Modus stimmt nicht.');
 // A verified Stripe subscription is linked through server-created metadata.
 order.customerId=sub.customer;const grant=invoiceGrant(invoice,sub,order),receipt=db.doc('billingInvoices/'+invoice.id),cycle=db.doc('billingCycles/'+grant.cycleId),slot=db.doc('billingAccounts/'+order.uid+'__'+order.category),ent=entitlement(order.category,order.uid),cr=db.doc('services/carwash/loyaltyContracts/'+order.uid);
 await db.runTransaction(async tx=>{
  const [seen,period,account,current,contract]=await tx.getAll(receipt,cycle,slot,ent,cr);if(seen.exists)return;
  if(account.data()?.orderId!==orderId)throw Error('Bestellung ist nicht mehr dem Kunden zugeordnet.');
  if(order.mode==='test'){
   tx.create(receipt,{uid:order.uid,name:order.name,category:order.category,plan:order.plan,orderId,subscriptionId:sub.id,invoiceId:invoice.id,amountCents:invoice.amount_paid,mode:'test',status:'test-paid',createdAt:stamp()});
   tx.update(ref,{status:'test-paid',subscriptionId:sub.id,customerId:sub.customer,updatedAt:stamp()});
   tx.set(slot,{customerId:sub.customer,lastTestInvoiceId:invoice.id,subscriptionId:sub.id,subscriptionActive:false,updatedAt:stamp()},{merge:true});return;
  }
  if(contract.exists&&order.category==='carwash'&&contract.data().contractId!==orderId)throw Error('Bestehenden Bonusvertrag nicht überschreiben.');
  tx.create(receipt,{uid:order.uid,name:order.name,category:order.category,plan:order.plan,orderId,subscriptionId:sub.id,invoiceId:invoice.id,amountCents:invoice.amount_paid,mode:order.mode,status:period.exists?'duplicate-cycle':'paid',periodStart:Timestamp.fromMillis(grant.start*1000),periodEnd:Timestamp.fromMillis(grant.end*1000),createdAt:stamp()});
  if(period.exists)return;
  tx.create(cycle,{orderId,invoiceId:invoice.id,createdAt:stamp()});
  const latest=(account.data()?.paidThrough?.toMillis()||0)<grant.end*1000;
  tx.update(ref,{status:'paid',subscriptionId:sub.id,customerId:sub.customer,updatedAt:stamp()});
  if(latest){tx.set(slot,{uid:order.uid,category:order.category,orderId,customerId:sub.customer,subscriptionId:sub.id,subscriptionActive:!['canceled','unpaid','incomplete_expired','paused'].includes(sub.status),paidThrough:Timestamp.fromMillis(grant.end*1000),lastInvoiceId:invoice.id,updatedAt:stamp()},{merge:true});
   if(grant.current){const common={name:order.name,email:order.email,remaining:order.units,active:true,validUntil:Timestamp.fromMillis(grant.end*1000),updatedAt:stamp(),updatedBy:'stripe'};
    if(order.category==='coffee')tx.set(ent,{...common,plan:order.plan,memberId:current.data()?.memberId||'MF-'+order.uid,createdAt:current.data()?.createdAt||stamp()},{merge:true});
    else tx.set(ent,{...common,uid:order.uid,offerId:order.offerId,offerName:order.planName,companyId:order.companyId,companyName:order.companyName,payoutCents:500,priceCents:order.priceCents,activeRequestId:current.data()?.activeRequestId||'',paymentReference:'stripe:'+invoice.id});
   }
  }
  if(order.category==='carwash'){
   const old=contract.data(),periodText=new Date(grant.start*1000).toISOString().slice(0,7),receiptId=orderId+'--'+periodText;
   const value=old||{uid:order.uid,name:order.name,companyId:order.companyId,companyName:order.companyName,offerId:order.offerId,contractId:orderId,planKey:order.plan,planName:order.planName,priceCents:order.priceCents,monthlyUnits:order.units,paidMonths:0,detailUsed:0,bonusWashUsed:0,voucherIssuedCents:0,lastBenefitId:'',washPayoutCents:500,detailPayoutCents:5000};
   tx.set(cr,{...value,paidMonths:value.paidMonths+1,lastPeriodStart:Timestamp.fromMillis(Math.max(value.lastPeriodStart?.toMillis()||0,grant.start*1000)),lastReceiptId:latest?receiptId:(value.lastReceiptId||receiptId),updatedAt:stamp(),updatedBy:'stripe'});
   tx.create(db.doc('services/carwash/monthlyPayments/'+receiptId),{uid:order.uid,contractId:orderId,period:periodText,periodStart:Timestamp.fromMillis(grant.start*1000),amountCents:order.priceCents,reference:'stripe:'+invoice.id,recordedAt:stamp(),recordedBy:'stripe'});
  }
 });
}
async function syncSubscription(id){const sub=await stripe('subscriptions/'+id),orderId=sub.metadata?.moOrderId;if(!/^[a-f0-9]{32}$/.test(orderId||''))return;const order=await db.doc('billingOrders/'+orderId).get();if(!order.exists)return;const o=order.data();if(o.mode==='test')return;const ref=db.doc('billingAccounts/'+o.uid+'__'+o.category);await db.runTransaction(async tx=>{const account=await tx.get(ref);if(account.data()?.orderId!==orderId)return;const stop=['canceled','unpaid','incomplete_expired','paused'].includes(sub.status);tx.update(ref,{subscriptionActive:!stop,subscriptionStatus:sub.status,cancelAtPeriodEnd:sub.cancel_at_period_end===true,updatedAt:stamp()});if(stop){tx.set(entitlement(o.category,o.uid),{active:false,updatedAt:stamp(),updatedBy:'stripe'},{merge:true});tx.update(order.ref,{status:'ended',updatedAt:stamp()});}});}
exports.stripeWebhook=onRequest({region,maxInstances:3,invoker:'public',secrets:[KEY,SIGNING]},async(req,res)=>{
 if(req.method!=='POST'){res.status(405).send('POST required');return;}let event;
 try{event=verifyEvent(req.rawBody,req.get('stripe-signature'),SIGNING.value());}catch{res.status(400).send('Invalid signature');return;}
 if(event.livemode!==(modeOf(KEY.value())==='live')){res.status(400).send('Wrong mode');return;}
 try{
  if(event.type==='invoice.paid'){const invoice=await stripe('invoices/'+event.data.object.id);await paidInvoice(invoice);}
  else if(event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted'){await syncSubscription(event.data.object.id);}
  else if(event.type==='invoice.payment_failed'){const inv=event.data.object;await db.doc('billingFailures/'+event.id).set({invoiceId:inv.id,subscriptionId:invoiceSubscription(inv)||'',status:'failed',createdAt:stamp()});}
  else if(event.type==='checkout.session.expired'){const session=event.data.object,id=session.metadata?.moOrderId;if(/^[a-f0-9]{32}$/.test(id||'')){const r=db.doc('billingOrders/'+id);await db.runTransaction(async tx=>{const o=await tx.get(r);if(o.exists&&o.data().status==='pending')tx.update(r,{status:'expired',updatedAt:stamp()});});}}
  res.status(200).send('ok');
 }catch{console.error('Stripe processing failed',event.id,event.type);res.status(500).send('Retry required');}
});
exports.getStripeStatus=onCall({region,maxInstances:3},async req=>{const u=uid(req),c=category(req.data?.category),a=await db.doc('billingAccounts/'+u+'__'+c).get(),s=await entitlement(c,u).get(),v=a.data();return {active:!!(v?.lastInvoiceId&&s.data()?.active===true&&s.data()?.validUntil?.toMillis()>Date.now()),testPaid:!!v?.lastTestInvoiceId,pending:!!v&&!v.lastInvoiceId&&!v.lastTestInvoiceId,subscriptionActive:v?.subscriptionActive===true,cancelAtPeriodEnd:v?.cancelAtPeriodEnd===true};});
exports.createStripePortal=onCall(options,async req=>{const u=uid(req),c=category(req.data?.category),a=await db.doc('billingAccounts/'+u+'__'+c).get(),id=a.data()?.customerId;if(typeof id!=='string'||!/^cus_[A-Za-z0-9]+$/.test(id))throw new HttpsError('failed-precondition','Noch kein Stripe-Kundenkonto vorhanden.');const result=await stripe('billing_portal/sessions','POST',{customer:id,return_url:publicBase()+'zahlung.html?bereich='+c});return {url:result.url};});
