'use strict';
const crypto=require('node:crypto');
const COFFEE=Object.freeze({basic:{name:'Basic',priceCents:2000,units:8},standard:{name:'Standard',priceCents:3500,units:16},premium:{name:'Premium',priceCents:6000,units:30},mittag:{name:'Mittagsmoment',priceCents:1000,units:0},cowork:{name:'Coworking',priceCents:2990,units:0}});
const WASH=Object.freeze({basic:{name:'Basic',priceCents:2490,units:2},plus:{name:'Plus',priceCents:3490,units:3},premium:{name:'Premium',priceCents:5490,units:5}});
function verifyEvent(raw,header,secret,now=Math.floor(Date.now()/1000)){
 if(!Buffer.isBuffer(raw)||typeof header!=='string'||typeof secret!=='string'||!secret.startsWith('whsec_'))throw Error('Invalid signature');
 const parts=header.split(',').map(x=>x.split('=')),times=parts.filter(x=>x[0]==='t');
 if(times.length!==1||!/^\d+$/.test(times[0][1]))throw Error('Invalid timestamp');
 const time=Number(times[0][1]);if(Math.abs(now-time)>300)throw Error('Expired signature');
 const digest=crypto.createHmac('sha256',secret).update(String(time)+'.').update(raw).digest();
 const valid=parts.some(([key,value])=>key==='v1'&&/^[a-f0-9]{64}$/.test(value||'')&&crypto.timingSafeEqual(digest,Buffer.from(value,'hex')));
 if(!valid)throw Error('Invalid signature');return JSON.parse(raw.toString('utf8'));
}
function formFields(value,prefix='',out=new URLSearchParams()){
 for(const [key,item] of Object.entries(value)){if(item===undefined||item===null)continue;const field=prefix?prefix+'['+key+']':key;if(typeof item==='object')formFields(item,field,out);else out.append(field,String(item));}return out;
}
function modeOf(key){if(key.startsWith('sk_test_'))return 'test';if(key.startsWith('sk_live_'))return 'live';throw Error('Stripe Secret Key fehlt oder ist ungültig.');}
function invoiceSubscription(invoice){return typeof invoice.parent?.subscription_details?.subscription==='string'?invoice.parent.subscription_details.subscription:typeof invoice.subscription==='string'?invoice.subscription:null;}
function invoiceGrant(invoice,sub,order,now=Math.floor(Date.now()/1000)){
 if(invoice.status!=='paid'||invoice.paid_out_of_band===true||invoice.currency!=='eur'||invoice.amount_paid!==order.priceCents||invoice.amount_due!==order.priceCents)throw Error('Rechnungsbetrag oder Zahlungsstatus stimmt nicht.');
 if(!['subscription_create','subscription_cycle'].includes(invoice.billing_reason))throw Error('Keine reguläre Monatsrechnung.');
 if(invoiceSubscription(invoice)!==sub.id||sub.metadata?.moOrderId!==order.id||sub.customer!==invoice.customer||sub.customer!==order.customerId)throw Error('Rechnung gehört nicht zu dieser Bestellung.');
 const items=sub.items?.data||[];if(items.length!==1||items[0].quantity!==1||items[0].price?.currency!=='eur'||items[0].price?.unit_amount!==order.priceCents||items[0].price?.recurring?.interval!=='month'||items[0].price?.recurring?.interval_count!==1)throw Error('Unerwartete Abo-Konfiguration.');
 const line=(invoice.lines?.data||[]).find(l=>(l.parent?.subscription_item_details?.subscription_item||l.subscription_item)===items[0].id);
 const start=line?.period?.start,end=line?.period?.end;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=end||end-start<20*86400||end-start>32*86400)throw Error('Ungültiger Monatszeitraum.');
 return {start,end,current:start<=now&&end>now&&sub.status==='active',cycleId:sub.id+'_'+start};
}
module.exports={COFFEE,WASH,verifyEvent,formFields,modeOf,invoiceSubscription,invoiceGrant};
