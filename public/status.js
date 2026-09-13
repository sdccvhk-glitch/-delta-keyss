const form=document.getElementById("statusForm"), result=document.getElementById("result");
const initial=new URLSearchParams(location.search).get("id");
if(initial){document.getElementById("orderId").value=initial; check(initial)}
form.addEventListener("submit",e=>{e.preventDefault();check(document.getElementById("orderId").value.trim())});
let timer=null;
async function check(id){
  if(!id)return;
  try{
    const r=await fetch("/api/orders/"+encodeURIComponent(id)); const out=await r.json();
    if(!r.ok) throw new Error(out.error||"Order not found.");
    const o=out.order;
    let extra="";
    if(o.status==="pending") extra=`<p class="muted">Your payment has been submitted. Please wait for admin verification.</p><p class="muted">This page will refresh automatically.</p>`;
    if(o.status==="rejected") extra=`<p class="error">Your payment submission was rejected. Please contact the store admin with your order ID.</p>`;
    if(o.status==="approved") extra=`<div class="key-box"><code id="key">${escapeHtml(o.key)}</code><button class="copy" onclick="copyKey()">Copy Key</button></div><p class="muted">Your payment was approved. Keep this key private.</p>`;
    result.innerHTML=`<div class="glass result-card"><div class="order-top"><div><h3>${escapeHtml(o.productName)}</h3><div class="order-meta">Order ${escapeHtml(o.id)}<br>${escapeHtml(o.customerName)}</div></div><span class="status ${o.status}">${o.status}</span></div>${extra}</div>`;
    clearInterval(timer);
    if(o.status==="pending") timer=setInterval(()=>check(id),5000);
  }catch(e){result.innerHTML=`<div class="glass result-card"><p class="error">${escapeHtml(e.message)}</p></div>`}
}
async function copyKey(){await navigator.clipboard.writeText(document.getElementById("key").textContent);alert("Key copied!")}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
