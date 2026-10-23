import {functions} from './firebase-client.mjs';
import {httpsCallable} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js';
import {paymentState} from './payment-state.mjs';
let state=paymentState(null),pending,lastCheck=0;
const listeners=new Set();
export async function getPaymentState(force=false){
  if(pending)return pending;
  if(!force&&Date.now()-lastCheck<15000)return state;
  pending=(async()=>{try{const result=await httpsCallable(functions,'getPaymentAvailability')({});state=paymentState(result.data);}catch{state=paymentState(null);}
    lastCheck=Date.now();for(const listener of listeners)listener(state);return state;
  })();try{return await pending;}finally{pending=null;}
}
export function watchPaymentState(listener){listeners.add(listener);listener(state);getPaymentState();return()=>listeners.delete(listener);}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)getPaymentState(true);});
setInterval(()=>{if(!document.hidden&&listeners.size)getPaymentState(true);},30000);
