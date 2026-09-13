(async()=>{
const q=new URLSearchParams(location.search),productId=q.get('product'),planId=q.get('plan');
const productEl=document.getElementById('payProduct'),durationEl=document.getElementById('payDuration'),amountEl=document.getElementById('payAmount');
const form=document.getElementById('paymentForm'),button=document.getElementById('payButton'),error=document.getElementById('error'),result=document.getElementById('result'),upiId=document.getElementById('upiId');
let product,plan;
try{
 const r=await fetch('/api/products'); if(!r.ok) throw Error('Could not load products.');
 const products=await r.json(); product=products.find(x=>x.id===productId);
 plan=product&&(product.plans||[]).find(x=>x.id===planId);
 if(!product||!plan) throw Error('Product or duration not found.');
 productEl.textContent=product.name; durationEl.textContent=plan.name; amountEl.textContent=Number(plan.price).toFixed(2);
 const info=await (await fetch('/api/payment-info')).json();
 upiId.textContent=info.upiId ? `Pay ₹${Number(plan.price).toFixed(2)} to UPI ID: ${info.upiId}` : `Pay exactly ₹${Number(plan.price).toFixed(2)} using the QR code above.`;
}catch(e){error.textContent=e.message;form.style.display='none'}
form.addEventListener('submit',async e=>{
 e.preventDefault(); button.disabled=true; button.textContent='Submitting…'; error.textContent='';
 try{
  const payload={productId,planId,paymentReference:document.getElementById('paymentReference').value};
  const r=await fetch('/api/payments/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const out=await r.json(); if(!r.ok) throw Error(out.error||'Could not submit payment.');
  result.hidden=false;
  result.innerHTML='<strong>Payment submitted ✓</strong><p>Your payment is waiting for admin verification.</p><p>Keep your Order ID safe:</p><div class="delivered-key">'+esc(out.order.id)+'</div><p class="muted">Once approved, your key will appear on the order status page.</p><a class="btn primary" href="/status?order='+encodeURIComponent(out.order.id)+'">Check Order Status →</a>';
  form.hidden=true; button.hidden=true;
 }catch(e){button.disabled=false;button.textContent='Submit Payment for Approval';error.textContent=e.message}
});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
})();