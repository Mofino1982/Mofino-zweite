export function paymentState(value) {
  const mode=['test','live'].includes(value?.mode)?value.mode:'setup';
  const enabled=value?.enabled===true&&mode!=='setup';
  return {mode,enabled,qrAvailable:value?.qrAvailable===true,
    coffee:enabled&&value?.coffee===true,carwash:enabled&&value?.carwash===true,
    catalog:enabled&&value?.catalog===true};
}
export function canPurchase(state,kind){return state.enabled===true&&state[kind]===true;}
export function purchaseLabel(state,kind){return !canPurchase(state,kind)?'Zahlungen werden vorbereitet':state.mode==='test'?'Testzahlung bei Stripe →':'Abo abschließen →';}
