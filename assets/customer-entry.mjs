// Authentication returns to the overview. Opening an offer requires a new category click.
export function showCustomerCategories(doc,schedule){
 const target=doc.getElementById('firmenkunden')||doc.getElementById('customerHome');
 if(!target)return;
 schedule(()=>{target.scrollIntoView?.({block:'start',behavior:'instant'});const title=target.querySelector?.('h2');title?.setAttribute('tabindex','-1');title?.focus({preventScroll:true});});
}
