(async()=>{
const q=new URLSearchParams(location.search),productId=q.get('product'),planId=q.get('plan');
const productEl=document.getElementById('payProduct'),durationEl=document.getElementById('payDuration'),amountEl=document.getElementById('payAmount'),button=document.getElementById('payButton'),error=document.getElementById('error'),result=document.getElementById('result');
let product,plan;
try{
 const r=await fetch('/api/products'); if(!r.ok) throw Error('Could not load products.');
 const products=await r.json(); product=products.find(x=>x.id===productId);
 plan=product&&(product.plans||[]).find(x=>x.id===planId);
 if(!product||!plan) throw Error('Product or duration not found.');
 productEl.textContent=product.name; durationEl.textContent=plan.name; amountEl.textContent=Number(plan.price).toFixed(2);
 const info=await (await fetch('/api/payment-info')).json();
 if(!info.enabled){button.disabled=true;button.textContent='Payment gateway not configured';throw Error('Automatic payment is not configured yet. The admin must add the gateway keys in Railway Variables.');}
 button.onclick=()=>startPayment(info);
}catch(e){error.textContent=e.message}
async function startPayment(info){
 button.disabled=true;button.textContent='Creating secure order…';error.textContent='';
 try{
  const r=await fetch('/api/payments/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,planId})});
  const out=await r.json();if(!r.ok)throw Error(out.error||'Could not create payment.');
  const options={key:out.keyId,amount:out.amount,currency:out.currency,name:out.name,description:out.description,order_id:out.orderId,theme:{color:'#4f7cff'},
   handler:async function(response){
    button.textContent='Verifying payment…';
    const vr=await fetch('/api/payments/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(response)});
    const vo=await vr.json();if(!vr.ok)throw Error(vo.error||'Payment verification failed.');
    result.hidden=false;result.innerHTML='<strong>Payment successful ✓</strong><p>Your key is ready.</p><div class="delivered-key">'+esc(vo.order.key)+'</div><p class="muted">Order <b>'+esc(vo.order.id)+'</b> • '+esc(vo.order.duration)+'</p><a class="btn primary" href="/status?order='+encodeURIComponent(vo.order.id)+'">View Order →</a>';
    button.hidden=true;
   },
   modal:{ondismiss:function(){button.disabled=false;button.textContent='Pay securely ↗';}}};
  const rzp=new Razorpay(options);rzp.on('payment.failed',function(){button.disabled=false;button.textContent='Pay securely ↗';error.textContent='Payment was not completed.'});rzp.open();
 }catch(e){button.disabled=false;button.textContent='Pay securely ↗';error.textContent=e.message}
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
})();