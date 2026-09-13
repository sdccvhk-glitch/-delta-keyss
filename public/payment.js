const qs=new URLSearchParams(location.search);
const productId=qs.get("product");
const selected=document.getElementById("selected");
const form=document.getElementById("orderForm");
const error=document.getElementById("error");

async function init(){
  if(!productId){ selected.textContent="No product selected."; form.style.display="none"; return; }
  const products=await fetch("/api/products").then(r=>r.json());
  const p=products.find(x=>x.id===productId);
  if(!p){selected.textContent="Product not found."; form.style.display="none"; return;}
  selected.innerHTML=`${escapeHtml(p.name)} <span style="color:#22d3ee">₹${Number(p.price).toFixed(0)}</span>`;
  const payment=await fetch("/api/payment-info").then(r=>r.json());
  const upiId=document.getElementById("upiId");
  const note=document.getElementById("paymentNote");
  upiId.textContent=payment.upiId;
  note.textContent=payment.note || "Scan with any UPI app, complete payment, then submit your details for manual admin verification.";
  const uri=`upi://pay?pa=${encodeURIComponent(payment.upiId)}&pn=${encodeURIComponent(payment.payeeName)}&am=${encodeURIComponent(Number(p.price).toFixed(2))}&cu=INR&tn=${encodeURIComponent(payment.note || `Order for ${p.name}`)}`;
  const qr=document.getElementById("qrCode");
  if(window.QRCode){new QRCode(qr,{text:uri,width:168,height:168,colorDark:"#171126",colorLight:"#fff8ee",correctLevel:QRCode.CorrectLevel.M});}
  else{qr.textContent="QR library unavailable. Use the UPI ID above.";}
}
form.addEventListener("submit",async e=>{
  e.preventDefault(); error.textContent="";
  const data={productId};
  try{
    const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const out=await r.json();
    if(!r.ok) throw new Error(out.error||"Could not create order.");
    location.href="/status?id="+encodeURIComponent(out.order.id);
  }catch(err){error.textContent=err.message}
});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
init();
