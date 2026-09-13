(async()=>{
const q=new URLSearchParams(location.search),productId=q.get('product'),planId=q.get('plan'),existingOrder=q.get('order');
const productEl=document.getElementById('payProduct'),durationEl=document.getElementById('payDuration'),amountEl=document.getElementById('payAmount');
const payButton=document.getElementById('payButton'),error=document.getElementById('error'),result=document.getElementById('result'),gatewayArea=document.getElementById('gatewayArea'),statusText=document.getElementById('paymentStatus'),timer=document.getElementById('timer');
let orderId=existingOrder, product, plan, polling=null, deadline=Date.now()+5*60*1000;
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function showError(msg){error.textContent=msg||''}
async function getJson(url,opts){const r=await fetch(url,opts);const out=await r.json().catch(()=>({}));if(!r.ok)throw Error(out.error||'Request failed.');return out}
async function poll(){
 if(!orderId)return;
 try{
  const out=await getJson('/api/payments/status/'+encodeURIComponent(orderId));
  const o=out.order;
  if(o.status==='paid'){
   clearInterval(polling); statusText.textContent='PAID'; timer.textContent='COMPLETE'; gatewayArea.hidden=true;
   result.hidden=false; result.innerHTML='<strong>Payment successful ✓</strong><p>Your key is ready.</p><p class="muted">Order ID</p><div class="delivered-key">'+esc(o.id)+'</div><p class="muted">License key</p><div class="delivered-key">'+esc(o.key)+'</div>';
   return;
  }
  statusText.textContent=o.status==='rejected'?'FAILED':'CHECKING PAYMENT';
  if(o.status==='rejected'){clearInterval(polling);timer.textContent='FAILED';showError('Payment was not completed. Please contact support.');}
 }catch(e){console.warn(e.message)}
 if(Date.now()>deadline){clearInterval(polling);timer.textContent='TIMEOUT';showError('Payment is still pending. Check your order status later.');}
}
function startPolling(){if(polling)clearInterval(polling);poll();polling=setInterval(poll,3000);}
try{
 const products=await getJson('/api/products'); product=products.find(x=>x.id===productId);
 plan=product&&(product.plans||[]).find(x=>x.id===planId);
 if(!product||!plan) throw Error('Product or duration not found.');
 productEl.textContent=product.name;durationEl.textContent=plan.name;amountEl.textContent=Number(plan.price).toFixed(2);
 const info=await getJson('/api/payment-info');
 if(!info.enabled)throw Error('Automatic UPI payment is not configured yet.');
 if(existingOrder){gatewayArea.hidden=true;statusText.textContent='CHECKING PAYMENT';timer.textContent='CHECKING';startPolling();}
}catch(e){showError(e.message);gatewayArea.hidden=true}

payButton?.addEventListener('click',async e=>{
 e.preventDefault();payButton.disabled=true;payButton.textContent='Creating payment…';showError('');
 try{
  const out=await getJson('/api/payments/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,planId})});
  orderId=out.order.id;deadline=Date.now()+5*60*1000;
  result.hidden=false;result.innerHTML='<strong>Payment created</strong><p>Opening secure UPI checkout…</p><p class="muted">Order ID</p><div class="delivered-key">'+esc(orderId)+'</div>';
  history.replaceState({},'',`/payment?order=${encodeURIComponent(orderId)}&product=${encodeURIComponent(productId)}&plan=${encodeURIComponent(planId)}`);
  if(!out.paymentSessionId)throw Error('Payment session was not returned by Cashfree.');
  const cashfree=Cashfree({mode:out.cashfreeMode||'sandbox'});
  const checkoutOptions={paymentSessionId:out.paymentSessionId,redirectTarget:'_self'};
  cashfree.checkout(checkoutOptions);
 }catch(e){payButton.disabled=false;payButton.textContent='Pay Now with UPI';showError(e.message)}
});
if(existingOrder)startPolling();
})();
