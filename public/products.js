async function loadProducts(){
  const box=document.getElementById("products");
  try{
    const r=await fetch("/api/products"); const products=await r.json();
    box.innerHTML=products.map(p=>`
      <article class="product glass">
        <span class="badge">${escapeHtml(p.badge||"KEY")}</span>
        <h2>${escapeHtml(p.name)}</h2>
        <p>${escapeHtml(p.description)}</p>
        <div class="price">₹${Number(p.price).toFixed(0)}</div>
        <a class="btn primary full" href="/payment?product=${encodeURIComponent(p.id)}">Select Product →</a>
      </article>`).join("");
  }catch(e){box.innerHTML="<p class='error'>Could not load products.</p>"}
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
loadProducts();
