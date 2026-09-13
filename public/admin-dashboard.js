const SESSION_MS=24*60*60*1000;
const authStore=localStorage.getItem('delta:adminAuth')?localStorage:sessionStorage;
let auth=authStore.getItem('delta:adminAuth')||'';
let loginAt=Number(authStore.getItem('delta:adminLoginAt')||0);
const $=id=>document.getElementById(id);
const dashboard=$('dashboard');
function logout(message=''){
  localStorage.removeItem('delta:adminAuth');
  localStorage.removeItem('delta:adminLoginAt');
  sessionStorage.removeItem('delta:adminAuth');
  sessionStorage.removeItem('delta:adminLoginAt');
  auth=''; loginAt=0;
  location.href='/admin-login.html'+(message?'?expired=1':'');
}
if(!auth||!loginAt||Date.now()-loginAt>=SESSION_MS){logout(true)}
async function api(url,opt={}){
  if(Date.now()-loginAt>=SESSION_MS) logout(true);
  opt.headers={...(opt.headers||{}),Authorization:auth,'Content-Type':'application/json'};
  const r=await fetch(url,opt); let out={}; try{out=await r.json()}catch{}
  if(r.status===401) logout(true);
  if(!r.ok) throw Error(out.error||`Request failed (${r.status})`);
  return out;
}
async function loadAdmin(){
  const out=await api('/api/admin/data'),orders=out.orders,products=out.products; window.__DELTA_PRODUCTS=products;
  const productOptions=products.map(p=>`<option value="${escAttr(p.id)}">${esc(p.name).toUpperCase()}</option>`).join('');
  const keyProduct=$('keyProduct'),uploadProduct=$('uploadProduct'),planProduct=$('planProduct');
  const current=keyProduct.value;
  keyProduct.innerHTML=productOptions;uploadProduct.innerHTML=productOptions;planProduct.innerHTML=productOptions;
  if(current&&products.some(p=>p.id===current))keyProduct.value=current;
  if(products.length){uploadProduct.value=keyProduct.value||products[0].id;planProduct.value=products[0].id}
  keyProduct.onchange=()=>{uploadProduct.value=keyProduct.value;refreshUploadPlans();};
  uploadProduct.onchange=refreshUploadPlans;
  $('vaultCount').textContent=String(out.keyPoolCount||0);
  $('stats').innerHTML=`<div class="admin-stat"><strong>${orders.length}</strong><span>Total orders</span></div><div class="admin-stat"><strong>${orders.filter(o=>o.status==='pending').length}</strong><span>Awaiting payment</span></div><div class="admin-stat"><strong>${orders.filter(o=>o.status==='paid').length}</strong><span>Paid orders</span></div><div class="admin-stat"><strong>${out.keyPoolCount||0}</strong><span>Vault keys</span></div>`;
  $('productsAdmin').innerHTML=products.map(p=>`<article class="order-card"><div class="order-top"><div><h3>${esc(p.name)}</h3><div class="order-meta">ID: ${esc(p.id)}<br>Stock: ${p.stock||0} • Plans: ${(p.plans||[]).length}</div></div><span class="badge">${esc(p.badge||'PRODUCT')}</span></div><div class="admin-controls product-edit"><input id="pn-${p.id}" value="${escAttr(p.name)}"><input id="pp-${p.id}" type="number" min="0" value="${Number(p.price)}"><input id="ps-${p.id}" type="number" min="0" value="${Number(p.stock||0)}"><input id="pd-${p.id}" value="${escAttr(p.description||'')}" placeholder="Description"><button onclick="editProduct('${p.id}')">Save product</button><button class="danger-btn" onclick="deleteProduct('${p.id}')">Delete</button></div></article>`).join('');
  $('plansAdmin').innerHTML=products.flatMap(p=>(p.plans||[]).map(pl=>`<article class="order-card"><div class="order-top"><div><h3>${esc(p.name)} — ${esc(pl.name)}</h3><div class="order-meta">Price: ₹${Number(pl.price).toFixed(0)} • ${Number(pl.durationHours||0)===0?'Lifetime':esc(pl.durationHours)+' hours'} • ${pl.active===false?'Disabled':'Active'}</div></div><span class="badge">${pl.active===false?'OFF':'ON'}</span></div><div class="admin-controls product-edit"><input id="pln-${pl.id}" value="${escAttr(pl.name)}"><input id="plh-${pl.id}" type="number" min="0" value="${Number(pl.durationHours||0)}"><input id="plp-${pl.id}" type="number" min="0" value="${Number(pl.price)}"><button onclick="editPlan('${p.id}','${pl.id}')">Save duration</button><button class="danger-btn" onclick="deletePlan('${p.id}','${pl.id}')">Delete</button></div></article>`)).join('')||`<div class='glass form-card'><p class='muted'>No durations yet.</p></div>`;
  $('orders').innerHTML=orders.length?orders.map(o=>`<article class="order-card"><div class="order-top"><div><h3>${esc(o.productName)}</h3><div class="order-meta">Order: ${esc(o.id)}<br>Duration: ${esc(o.duration||'—')}<br>Amount: ₹${Number(o.amount).toFixed(0)}<br>Payment: ${esc(o.paymentReference||'Waiting for verified payment')}</div></div><span class="status ${o.status}">${o.status}</span></div><div class="admin-controls"><input id="key-${o.id}" value="${escAttr(o.key||'')}" placeholder="Customer key"><select id="status-${o.id}"><option ${o.status==='pending'?'selected':''}>pending</option><option ${o.status==='paid'?'selected':''}>paid</option><option ${o.status==='rejected'?'selected':''}>rejected</option></select><button onclick="saveOrder('${o.id}')">Save order</button></div></article>`).join(''):`<div class='glass form-card'><p class='muted'>No orders yet.</p></div>`;
  refreshUploadPlans();
}
function refreshUploadPlans(){
  const p=productsCache().find(x=>x.id===$('uploadProduct').value),sel=$('uploadPlan');
  sel.innerHTML=(p?.plans||[]).filter(x=>x.active!==false).map(pl=>`<option value="${escAttr(pl.id)}">${esc(pl.name)} — ₹${Number(pl.price).toFixed(0)}</option>`).join('');
}
function productsCache(){return window.__DELTA_PRODUCTS||[]}

$('refresh').onclick=loadAdmin;
$('productForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/products',{method:'POST',body:JSON.stringify({name:$('pName').value,price:$('pPrice').value,stock:$('pStock').value,badge:$('pBadge').value,description:$('pDescription').value})});e.target.reset();await loadAdmin();alert('Product added.')}catch(err){alert(err.message)}});
$('planProduct').onchange=()=>{};
$('planForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/plans',{method:'POST',body:JSON.stringify({productId:$('planProduct').value,name:$('planName').value,durationHours:$('planHours').value,price:$('planPrice').value})});e.target.reset();await loadAdmin();alert('Duration added.')}catch(err){alert(err.message)}});
async function editPlan(productId,planId){try{await api('/api/admin/plans/'+encodeURIComponent(productId)+'/'+encodeURIComponent(planId),{method:'PUT',body:JSON.stringify({name:$('pln-'+planId).value,durationHours:$('plh-'+planId).value,price:$('plp-'+planId).value})});await loadAdmin()}catch(e){alert(e.message)}}
async function deletePlan(productId,planId){if(!confirm('Delete this duration?'))return;try{await api('/api/admin/plans/'+encodeURIComponent(productId)+'/'+encodeURIComponent(planId),{method:'DELETE'});await loadAdmin()}catch(e){alert(e.message)}}
async function editProduct(id){try{await api('/api/admin/products/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({name:$('pn-'+id).value,price:$('pp-'+id).value,stock:$('ps-'+id).value,description:$('pd-'+id).value})});await loadAdmin()}catch(e){alert(e.message)}}
async function deleteProduct(id){if(!confirm('Delete this product?'))return;try{await api('/api/admin/products/'+encodeURIComponent(id),{method:'DELETE'});await loadAdmin()}catch(e){alert(e.message)}}
async function saveOrder(id){try{const key=$('key-'+id).value,status=$('status-'+id).value;await api('/api/admin/orders/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({key,status})});alert(status==='approved'?'Approved — key is now visible to the customer.':'Order updated.');await loadAdmin()}catch(e){alert(e.message)}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function escAttr(s){return esc(s).replace(/`/g,'&#096;')}
$('menuToggle').onclick=()=>{$('adminMenu').hidden=!$('adminMenu').hidden};
$('adminBadge').onclick=()=>{$('adminMenu').hidden=!$('adminMenu').hidden};
$('menuLogout').onclick=()=>logout();
$('keysForm').addEventListener('submit',async e=>{e.preventDefault();try{const keys=$('keysInput').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!keys.length)throw Error('Paste at least one key.');const out=await api('/api/admin/keys',{method:'POST',body:JSON.stringify({keys,productId:$('uploadProduct').value,planId:$('uploadPlan').value})});$('keysInput').value='';$('keyUploadMsg').textContent=`Uploaded ${out.added} keys. Vault total: ${out.total}.`;await loadAdmin()}catch(err){$('keyUploadMsg').textContent=err.message}});
loadAdmin().catch(err=>{if(!String(err.message).includes('redirect')) alert(err.message)});
