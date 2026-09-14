(async()=>{
const q=new URLSearchParams(location.search),productId=q.get('product'),planId=q.get('plan');
const productEl=document.getElementById('payProduct'),durationEl=document.getElementById('payDuration'),amountEl=document.getElementById('payAmount');
const form=document.getElementById('paymentForm'),startButton=document.getElementById('startPaymentButton'),submitButton=document.getElementById('submitUtrButton');
const error=document.getElementById('error'),result=document.getElementById('result'),upiId=document.getElementById('upiId'),upiPayee=document.getElementById('upiPayee'),upiQr=document.getElementById('upiQr'),copyUpiButton=document.getElementById('copyUpiButton'),paymentStep=document.getElementById('paymentStep'),utrStep=document.getElementById('utrStep'),orderIdEl=document.getElementById('orderId');
let product,plan,order=null,currentUpiId='';
try{
 const r=await fetch('/api/products'); if(!r.ok) throw Error('Could not load products.');
 const products=await r.json(); product=products.find(x=>x.id===productId); plan=product&&(product.plans||[]).find(x=>x.id===planId);
 if(!product||!plan) throw Error('Product or duration not found.');
 productEl.textContent=product.name; durationEl.textContent=plan.name; amountEl.textContent=Number(plan.price).toFixed(2);
 const info=await (await fetch('/api/payment-info')).json();
 currentUpiId=String(info.upiId||'').trim(); upiId.textContent=currentUpiId ? `Pay exactly ₹${Number(plan.price).toFixed(2)} to ${currentUpiId}` : `UPI payment is not configured yet.`; upiPayee.textContent=info.payeeName ? `Payee: ${info.payeeName}` : ''; copyUpiButton.disabled=!currentUpiId;
}catch(e){error.textContent=e.message;startButton.disabled=true;}

startButton.addEventListener('click',async()=>{
 error.textContent=''; startButton.disabled=true; startButton.textContent='Preparing payment…';
 try{
  const r=await fetch('/api/payments/start-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,planId})});
  const out=await r.json(); if(!r.ok) throw Error(out.error||'Could not start payment.');
  order=out.order; orderIdEl.textContent=order.id;
  paymentStep.hidden=true; utrStep.hidden=false;
  if(out.qrDataUrl) upiQr.src=out.qrDataUrl;
  if(out.upiId) { currentUpiId=out.upiId; upiId.textContent=`Pay exactly ₹${Number(out.amount).toFixed(2)} to ${out.upiId}`; }
  if(out.payeeName) upiPayee.textContent=`Payee: ${out.payeeName}`;
  if(out.upiLink){
    // Give Android a real user-initiated UPI intent. If no UPI app handles it, the QR remains available.
    window.location.assign(out.upiLink);
  }
 }catch(e){startButton.disabled=false;startButton.textContent='Pay Now with UPI';error.textContent=e.message;}
});

form.addEventListener('submit',async e=>{
 e.preventDefault(); if(!order?.id){error.textContent='Please start the UPI payment first.';return;}
 submitButton.disabled=true;submitButton.textContent='Submitting…';error.textContent='';
 try{
  const r=await fetch('/api/payments/submit-utr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:order.id,paymentReference:document.getElementById('paymentReference').value})});
  const out=await r.json(); if(!r.ok) throw Error(out.error||'Could not submit UTR.');
  result.hidden=false; result.innerHTML='<strong>UTR submitted ✓</strong><p>Your order is pending admin verification.</p><p>Order ID:</p><div class="delivered-key">'+esc(out.order.id)+'</div><p class="muted">The key is released only after the admin confirms the payment in the receiving UPI/bank account.</p><a class="btn primary" href="/status?order='+encodeURIComponent(out.order.id)+'">Check Order Status →</a>';
  form.hidden=true;
 }catch(e){submitButton.disabled=false;submitButton.textContent='Submit UTR for Verification';error.textContent=e.message;}
});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
})();
copyUpiButton?.addEventListener('click', async()=>{ if(!currentUpiId)return; try{await navigator.clipboard.writeText(currentUpiId); copyUpiButton.textContent='UPI ID Copied ✓'; setTimeout(()=>copyUpiButton.textContent='Copy UPI ID',1800);}catch{error.textContent='Copy failed. Long-press the UPI ID to copy it.';} });
