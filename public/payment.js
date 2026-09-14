(async()=>{
const q=new URLSearchParams(location.search),productId=q.get('product'),planId=q.get('plan');
const productEl=document.getElementById('payProduct'),durationEl=document.getElementById('payDuration'),amountEl=document.getElementById('payAmount');
const form=document.getElementById('paymentForm'),startButton=document.getElementById('startPaymentButton'),submitButton=document.getElementById('submitUtrButton');
const error=document.getElementById('error'),result=document.getElementById('result'),upiId=document.getElementById('upiId'),upiPayee=document.getElementById('upiPayee'),upiQr=document.getElementById('upiQr');
const copyUpiButton=document.getElementById('copyUpiButton'),paymentStep=document.getElementById('paymentStep'),paymentActions=document.getElementById('paymentActions'),openUpiButton=document.getElementById('openUpiButton'),utrStep=document.getElementById('utrStep'),orderIdEl=document.getElementById('orderId'),qrStatus=document.getElementById('qrStatus');

let product,plan,order=null,currentUpiId='';

function showError(message){ error.textContent=message||''; }

try{
  const r=await fetch('/api/products',{cache:'no-store'});
  if(!r.ok) throw Error('Could not load products.');
  const products=await r.json();
  product=products.find(x=>x.id===productId);
  plan=product&&(product.plans||[]).find(x=>x.id===planId);
  if(!product||!plan) throw Error('Product or duration not found.');

  productEl.textContent=product.name;
  durationEl.textContent=plan.name;
  amountEl.textContent=Number(plan.price).toFixed(2);

  const infoResponse=await fetch('/api/payment-info',{cache:'no-store'});
  if(!infoResponse.ok) throw Error('Could not load UPI payment settings.');
  const info=await infoResponse.json();

  currentUpiId=String(info.upiId||'').trim();
  upiId.textContent=currentUpiId
    ? `Pay exactly ₹${Number(plan.price).toFixed(2)} to ${currentUpiId}`
    : 'UPI payment is not configured yet.';
  upiPayee.textContent=info.payeeName ? `Payee: ${info.payeeName}` : '';
  copyUpiButton.disabled=!currentUpiId;
  startButton.disabled=!currentUpiId;
  if(!currentUpiId) showError('UPI ID is not configured. Ask the admin to set the receiving UPI ID.');
}catch(e){
  showError(e.message);
  startButton.disabled=true;
}

copyUpiButton.addEventListener('click',async()=>{
  if(!currentUpiId) return;
  try{
    await navigator.clipboard.writeText(currentUpiId);
    copyUpiButton.textContent='UPI ID Copied ✓';
    setTimeout(()=>copyUpiButton.textContent='Copy UPI ID',1800);
  }catch{
    showError('Copy failed. Long-press the UPI ID to copy it.');
  }
});

startButton.addEventListener('click',async()=>{
  showError('');
  startButton.disabled=true;
  startButton.textContent='Generating QR…';

  try{
    const r=await fetch('/api/payments/start-order',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      cache:'no-store',
      body:JSON.stringify({productId,planId})
    });
    const out=await r.json();
    if(!r.ok) throw Error(out.error||'Could not start payment.');

    order=out.order;
    orderIdEl.textContent=order.id;

    // The server-created QR is the authoritative QR for this order.
    // It contains the exact order amount, not the product's base price.
    if(!out.qrDataUrl || !out.upiLink) throw Error('The server did not return a valid exact-price UPI QR.');

    upiQr.src=out.qrDataUrl;
    upiQr.style.display='block';
    qrStatus.textContent=`Exact payment QR generated for ₹${Number(out.amount).toFixed(2)}.`;

    currentUpiId=String(out.upiId||currentUpiId).trim();
    upiId.textContent=`Pay exactly ₹${Number(out.amount).toFixed(2)} to ${currentUpiId}`;
    upiPayee.textContent=out.payeeName ? `Payee: ${out.payeeName}` : '';

    openUpiButton.href=out.upiLink;
    paymentStep.hidden=true;
    paymentActions.hidden=false;
    utrStep.hidden=false;

    // Do NOT force window.location.assign() here.
    // Keeping the UPI link as a normal user-clicked <a> is more reliable on Android.
    startButton.textContent='QR Generated ✓';
  }catch(e){
    startButton.disabled=false;
    startButton.textContent='Generate Exact Payment QR';
    showError(e.message);
  }
});

form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!order?.id){showError('Generate the payment QR first.');return;}

  submitButton.disabled=true;
  submitButton.textContent='Submitting…';
  showError('');

  try{
    const r=await fetch('/api/payments/submit-utr',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      cache:'no-store',
      body:JSON.stringify({
        orderId:order.id,
        paymentReference:document.getElementById('paymentReference').value.trim()
      })
    });
    const out=await r.json();
    if(!r.ok) throw Error(out.error||'Could not submit UTR.');

    result.hidden=false;
    result.innerHTML='<strong>UTR submitted ✓</strong><p>Your order is pending admin verification.</p><p>Order ID:</p><div class="delivered-key">'+esc(out.order.id)+'</div><p class="muted">The key is released only after the admin confirms the payment in the receiving UPI/bank account.</p><a class="btn primary" href="/status?order='+encodeURIComponent(out.order.id)+'">Check Order Status →</a>';
    form.hidden=true;
    paymentActions.hidden=true;
  }catch(e){
    submitButton.disabled=false;
    submitButton.textContent='Submit UTR for Verification';
    showError(e.message);
  }
});

function esc(s){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
})();