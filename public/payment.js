(async()=>{
 const q=new URLSearchParams(location.search),id=q.get('product'),selected=document.getElementById('payProduct');
 const amount=document.getElementById('payAmount'),upiOpen=document.getElementById('upiOpen');
 try{
  const [pr,pi]=await Promise.all([fetch('/api/products'),fetch('/api/payment-info')]);
  const products=await pr.json(),info=await pi.json();
  const p=products.find(x=>x.id===id)||products[0]; if(!p)throw Error('No product available');
  window.DELTA_PRODUCT=p;
  selected.textContent=p.name;
  amount.textContent=Number(p.price).toFixed(2);
  const duration=q.get('duration');
  if(duration) selected.textContent=p.name;
  const upi='upi://pay?pa='+encodeURIComponent(info.upiId)+'&pn='+encodeURIComponent(info.payeeName)+'&am='+encodeURIComponent(Number(p.price).toFixed(2))+'&cu=INR';
  upiOpen.href=upi;
 }catch(e){
  selected.textContent=e.message;
  document.getElementById('paymentForm').hidden=true;
 }
})();
document.getElementById('paymentForm').addEventListener('submit',async e=>{
 e.preventDefault();const err=document.getElementById('error');err.textContent='';
 try{
  const p=window.DELTA_PRODUCT;if(!p)throw Error('Product is not ready.');
  const reference=document.getElementById('reference').value.trim();
  if(!reference)throw Error('UTR / UPI transaction ID is required.');
  const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:p.id,paymentReference:reference})});
  const out=await r.json();if(!r.ok)throw Error(out.error||'Could not create order');
  const box=document.getElementById('result');box.hidden=false;
  box.innerHTML='<strong>Payment submitted.</strong><p class="muted">Order <b>'+esc(out.order.id)+'</b> is waiting for admin verification. Use Check Order for updates.</p><a class="btn primary" href="/status?order='+encodeURIComponent(out.order.id)+'">Check Order →</a>';
  e.target.hidden=true;
 }catch(x){err.textContent=x.message}
});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
