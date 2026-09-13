const SESSION_MS=24*60*60*1000;
const authStore=localStorage.getItem('delta:adminAuth')?localStorage:sessionStorage;
let auth=authStore.getItem('delta:adminAuth')||'';
let loginAt=Number(authStore.getItem('delta:adminLoginAt')||0);
const $=id=>document.getElementById(id);
if(!auth||!loginAt||Date.now()-loginAt>=SESSION_MS) logout(true);
function logout(message=''){
  localStorage.removeItem('delta:adminAuth');localStorage.removeItem('delta:adminLoginAt');
  sessionStorage.removeItem('delta:adminAuth');sessionStorage.removeItem('delta:adminLoginAt');
  auth='';loginAt=0;location.href='/admin-login.html'+(message?'?expired=1':'');
}
async function api(url,opt={}){
  if(Date.now()-loginAt>=SESSION_MS) logout(true);
  opt.headers={...(opt.headers||{}),Authorization:auth,'Content-Type':'application/json'};
  const r=await fetch(url,opt);let out={};try{out=await r.json()}catch{}
  if(r.status===401){logout(true);return}
  if(!r.ok) throw Error(out.error||`Request failed (${r.status})`);return out;
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function escAttr(s){return esc(s).replace(/`/g,'&#096;')}
function productsCache(){return window.__DELTA_PRODUCTS||[]}
const DEFAULT_NAV_ORDER=['dashboard','orders','products','keys','durations','settings','telegram'];
function navButtons(){return Array.from(document.querySelectorAll('#adminNav .nav-item'))}
function applyNavOrder(order){
  const nav=$('adminNav'); if(!nav)return;
  const buttons=navButtons();
  const byPage=new Map(buttons.map(b=>[b.dataset.page,b]));
  const final=[...(order||[]),...DEFAULT_NAV_ORDER].filter((page,i,a)=>a.indexOf(page)===i&&byPage.has(page));
  final.forEach(page=>nav.appendChild(byPage.get(page)));
}
function currentNavOrder(){return navButtons().map(b=>b.dataset.page)}
async function saveNavOrder(){
  const order=currentNavOrder();
  localStorage.setItem('delta:adminNavOrder',JSON.stringify(order));
  try{await api('/api/admin/sidebar-order',{method:'PUT',body:JSON.stringify({order})})}catch(e){/* local fallback keeps the order on this device */}
}
let draggingNav=null,dragPointerId=null,dragMoved=false,dragStartX=0,dragStartY=0,dragCandidate=null,dragSuppressClick=false;
function moveNavItem(x,y){
  const nav=$('adminNav'); if(!nav||!draggingNav)return;
  const target=document.elementFromPoint(x,y)?.closest?.('.nav-item');
  if(!target||target===draggingNav||!nav.contains(target))return;
  const r=target.getBoundingClientRect();
  if(y<r.top+r.height/2) nav.insertBefore(draggingNav,target);
  else nav.insertBefore(draggingNav,target.nextSibling);
}
function finishNavDrag(){
  if(!draggingNav)return;
  draggingNav.classList.remove('dragging');
  draggingNav=null;
  dragCandidate=null;
  dragPointerId=null;
  if(dragMoved){saveNavOrder();dragSuppressClick=true;}
}
function setupNavDnD(){
  const nav=$('adminNav'); if(!nav)return;
  const items=()=>Array.from(nav.querySelectorAll('.nav-item'));
  let dragging=null, pointerId=null, startY=0, active=false, suppress=false;

  function save(){
    const order=items().map(x=>x.dataset.page); localStorage.setItem('delta_nav_order',JSON.stringify(order));
    api('/api/admin/nav-order',{method:'PUT',body:JSON.stringify({order})}).catch(()=>{});
  }
  function moveAt(y){
    if(!dragging)return;
    const others=items().filter(x=>x!==dragging);
    let before=null;
    for(const el of others){ const r=el.getBoundingClientRect(); if(y < r.top+r.height/2){before=el;break;} }
    if(before) nav.insertBefore(dragging,before); else nav.appendChild(dragging);
  }
  function end(){
    if(!dragging)return;
    dragging.classList.remove('dragging');
    dragging.style.pointerEvents='';
    if(active) save();
    dragging=null; pointerId=null; active=false;
  }
  function begin(el,e){
    if(e.pointerType==='mouse' && e.button!==0)return;
    e.preventDefault(); e.stopPropagation();
    dragging=el; pointerId=e.pointerId; startY=e.clientY; active=false;
    el.classList.add('dragging');
    try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}
  }
  nav.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('.nav-drag');
    if(handle){begin(handle.closest('.nav-item'),e);return;}
    // On phones, allow dragging by pressing anywhere on the menu item, but do not trigger navigation until release.
    const item=e.target.closest('.nav-item');
    if(item && e.pointerType==='touch'){begin(item,e);}
  },{passive:false});
  nav.addEventListener('pointermove',e=>{
    if(!dragging || e.pointerId!==pointerId)return;
    if(!active){
      if(Math.abs(e.clientY-startY)<5)return;
      active=true;
      dragging.style.pointerEvents='none';
    }
    e.preventDefault(); moveAt(e.clientY);
  },{passive:false});
  nav.addEventListener('pointerup',e=>{
    if(!dragging || e.pointerId!==pointerId)return;
    e.preventDefault();
    const wasActive=active; end();
    if(wasActive)suppress=true;
  },{passive:false});
  nav.addEventListener('pointercancel',end,{passive:false});
  nav.addEventListener('contextmenu',e=>{ if(e.target.closest('.nav-item')) e.preventDefault(); });

  // Guaranteed mobile fallback: explicit ▲/▼ controls.
  nav.addEventListener('click',e=>{
    const up=e.target.closest('.nav-up'), down=e.target.closest('.nav-down');
    if(up||down){
      e.preventDefault(); e.stopPropagation();
      const item=(up||down).closest('.nav-item'), all=items(), i=all.indexOf(item);
      if(up && i>0) nav.insertBefore(item,all[i-1]);
      if(down && i<all.length-1) nav.insertBefore(item,all[i+1].nextSibling);
      save(); return;
    }
    if(suppress){suppress=false;e.preventDefault();e.stopPropagation();return;}
    const item=e.target.closest('.nav-item'); if(item) openPage(item.dataset.page);
  });
  $('resetNavOrder').onclick=async()=>{applyNavOrder(DEFAULT_NAV_ORDER);await save()};
}
function openPage(page){
  document.querySelectorAll('.admin-view').forEach(x=>x.classList.remove('active'));
  const target=$('page-'+page);if(target) target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  const titles={dashboard:'Dashboard',orders:'Orders',products:'Products',keys:'Product Keys',durations:'Product Duration',settings:'Settings',telegram:'Telegram Bot'};
  $('pageTitle').textContent=titles[page]||'Dashboard';closeMenu();
}
function closeMenu(){$('adminSidebar').hidden=true;$('sidebarBackdrop').hidden=true}
function toggleMenu(){const open=$('adminSidebar').hidden;$('adminSidebar').hidden=!open;$('sidebarBackdrop').hidden=!open}
$('menuToggle').onclick=toggleMenu;$('adminBadge').onclick=toggleMenu;$('sidebarBackdrop').onclick=closeMenu;
$('menuLogout').onclick=()=>logout();
setupNavDnD();
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>openPage(btn.dataset.go)));

async function loadAdmin(){
  const out=await api('/api/admin/data');if(!out)return;
  const orders=out.orders||[],products=out.products||[],pool=out.keyPool||[];window.__DELTA_PRODUCTS=products;window.__DELTA_KEYPOOL=pool;
  const paid=orders.filter(o=>o.status==='paid'),pending=orders.filter(o=>o.status==='pending');
  const revenue=paid.reduce((sum,o)=>sum+Number(o.amount||0),0);
  const usedKeys=orders.filter(o=>o.key).length,totalKeys=pool.length+usedKeys;
  $('dashTotal').textContent=orders.length;$('dashPaid').textContent=paid.length;$('dashPending').textContent=pending.length;$('dashRevenue').textContent='₹'+revenue.toFixed(0);$('dashKeys').textContent=totalKeys;$('dashUnused').textContent=pool.length;$('keyPoolBadge').textContent=pool.length+' KEYS';
  $('paymentUpiId').value=out.paymentSettings?.upiId||'';$('paymentPayeeName').value=out.paymentSettings?.payeeName||'DELTA.KEYS';
  const options=products.map(p=>`<option value="${escAttr(p.id)}">${esc(p.name).toUpperCase()}</option>`).join('');
  ['keyProduct','uploadProduct','planProduct'].forEach(id=>$(id).innerHTML=options);
  if(products.length){$('uploadProduct').value=$('keyProduct').value||products[0].id;$('planProduct').value=products[0].id}
  $('keyProduct').onchange=()=>{$('uploadProduct').value=$('keyProduct').value;refreshUploadPlans()};$('uploadProduct').onchange=refreshUploadPlans;
  renderStock(products,pool);renderProducts(products);renderPlans(products);renderOrders(orders);refreshUploadPlans();
}
function keyCount(pool,pid,planId){return pool.filter(item=>typeof item!=='string'&&item.productId===pid&&(!planId||item.planId===planId)).length}
function renderStock(products,pool){
  $('stockByProduct').innerHTML=products.length?products.map(p=>`<div class="stock-product"><h3>${esc(p.name)}</h3>${(p.plans||[]).map(pl=>`<div class="stock-plan"><span>₹${Number(pl.price||0).toFixed(0)} &nbsp; ${esc(pl.name)}</span><span class="stock-count">✓ ${keyCount(pool,p.id,pl.id)}</span></div>`).join('')}</div>`).join(''):`<p class="video-muted">No products yet.</p>`;
}
function renderProducts(products){
  $('productsAdmin').innerHTML=products.length?products.map(p=>`<article class="order-card"><div class="order-top"><div><h3>${esc(p.name)}</h3><div class="order-meta">ID: ${esc(p.id)}<br>Stock: ${Number(p.stock||0)} • Plans: ${(p.plans||[]).length}</div></div><span class="video-chip">${esc(p.badge||'PRODUCT')}</span></div><div class="admin-controls product-edit"><input id="pn-${p.id}" value="${escAttr(p.name)}"><input id="pp-${p.id}" type="number" min="0" value="${Number(p.price||0)}"><input id="ps-${p.id}" type="number" min="0" value="${Number(p.stock||0)}"><input id="pd-${p.id}" value="${escAttr(p.description||'')}" placeholder="Description"><button onclick="editProduct('${p.id}')">Save</button><button class="danger-btn" onclick="deleteProduct('${p.id}')">Delete</button></div></article>`).join(''):`<p class="video-muted">No products yet.</p>`;
}
function renderPlans(products){
  $('plansAdmin').innerHTML=products.flatMap(p=>(p.plans||[]).map(pl=>`<article class="order-card"><div class="order-top"><div><h3>${esc(p.name)} — ${esc(pl.name)}</h3><div class="order-meta">Price: ₹${Number(pl.price||0).toFixed(0)} • ${Number(pl.durationHours||0)===0?'Lifetime':esc(pl.durationHours)+' hours'}</div></div><span class="video-chip ${pl.active===false?'':'success'}">${pl.active===false?'OFF':'ON'}</span></div><div class="admin-controls product-edit"><input id="pln-${pl.id}" value="${escAttr(pl.name)}"><input id="plh-${pl.id}" type="number" min="0" value="${Number(pl.durationHours||0)}"><input id="plp-${pl.id}" type="number" min="0" value="${Number(pl.price||0)}"><button onclick="editPlan('${p.id}','${pl.id}')">Save</button><button class="danger-btn" onclick="deletePlan('${p.id}','${pl.id}')">Delete</button></div></article>`)).join('')||`<p class="video-muted">No durations yet.</p>`;
}
function renderOrders(orders){
  $('orders').innerHTML=orders.length?orders.map(o=>`<article class="order-card"><div class="order-top"><div><h3>${esc(o.productName)}</h3><div class="order-meta">Order: ${esc(o.id)}<br>Payment: MANUAL UPI + ADMIN APPROVAL<br>Duration: ${esc(o.duration||'—')}<br>Amount: ₹${Number(o.amount||0).toFixed(0)}<br>UPI UTR: <strong>${esc(o.paymentReference||'—')}</strong></div></div><span class="video-chip ${o.status==='paid'?'success':''}">${esc(o.status)}</span></div><div class="admin-controls"><select id="status-${o.id}"><option ${o.status==='pending'?'selected':''}>pending</option><option ${o.status==='paid'?'selected':''}>paid</option><option ${o.status==='rejected'?'selected':''}>rejected</option></select><button onclick="saveOrder('${o.id}')">${o.status==='pending'?'Verify & Approve':'Update Order'}</button></div></article>`).join(''):`<p class="video-muted">No orders yet.</p>`;
}
function refreshUploadPlans(){const p=productsCache().find(x=>x.id===$('uploadProduct').value),sel=$('uploadPlan');sel.innerHTML=(p?.plans||[]).filter(x=>x.active!==false).map(pl=>`<option value="${escAttr(pl.id)}">${esc(pl.name)} — ₹${Number(pl.price||0).toFixed(0)}</option>`).join('')}
$('refresh').onclick=loadAdmin;
$('paymentSettingsForm').addEventListener('submit',async e=>{e.preventDefault();try{const out=await api('/api/admin/payment-settings',{method:'PUT',body:JSON.stringify({upiId:$('paymentUpiId').value,payeeName:$('paymentPayeeName').value})});$('paymentSettingsMsg').textContent=out.message||'Payment settings saved.';await loadAdmin()}catch(err){$('paymentSettingsMsg').textContent=err.message}});
$('changePasswordForm').addEventListener('submit',async e=>{e.preventDefault();const msg=$('changePasswordMsg');msg.textContent='';try{const out=await api('/api/admin/change-password',{method:'PUT',body:JSON.stringify({currentPassword:$('currentAdminPassword').value,newPassword:$('newAdminPassword').value,confirmPassword:$('confirmAdminPassword').value})});msg.textContent=out.message||'Password changed.';setTimeout(()=>logout(false),900)}catch(err){msg.textContent=err.message}});
$('productForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/products',{method:'POST',body:JSON.stringify({name:$('pName').value,price:$('pPrice').value,stock:$('pStock').value,badge:$('pBadge').value,description:$('pDescription').value})});e.target.reset();await loadAdmin();alert('Product added.')}catch(err){alert(err.message)}});
$('planForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/plans',{method:'POST',body:JSON.stringify({productId:$('planProduct').value,name:$('planName').value,durationHours:$('planHours').value,price:$('planPrice').value})});e.target.reset();await loadAdmin();alert('Duration added.')}catch(err){alert(err.message)}});
$('keysForm').addEventListener('submit',async e=>{e.preventDefault();try{const keys=$('keysInput').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!keys.length)throw Error('Paste at least one key.');const out=await api('/api/admin/keys',{method:'POST',body:JSON.stringify({keys,productId:$('uploadProduct').value,planId:$('uploadPlan').value})});$('keysInput').value='';$('keyUploadMsg').textContent=`Uploaded ${out.added} keys. Vault total: ${out.total}.`;await loadAdmin()}catch(err){$('keyUploadMsg').textContent=err.message}});
async function editPlan(productId,planId){try{await api('/api/admin/plans/'+encodeURIComponent(productId)+'/'+encodeURIComponent(planId),{method:'PUT',body:JSON.stringify({name:$('pln-'+planId).value,durationHours:$('plh-'+planId).value,price:$('plp-'+planId).value})});await loadAdmin()}catch(e){alert(e.message)}}
async function deletePlan(productId,planId){if(!confirm('Delete this duration?'))return;try{await api('/api/admin/plans/'+encodeURIComponent(productId)+'/'+encodeURIComponent(planId),{method:'DELETE'});await loadAdmin()}catch(e){alert(e.message)}}
async function editProduct(id){try{await api('/api/admin/products/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({name:$('pn-'+id).value,price:$('pp-'+id).value,stock:$('ps-'+id).value,description:$('pd-'+id).value})});await loadAdmin()}catch(e){alert(e.message)}}
async function deleteProduct(id){if(!confirm('Delete this product?'))return;try{await api('/api/admin/products/'+encodeURIComponent(id),{method:'DELETE'});await loadAdmin()}catch(e){alert(e.message)}}
async function saveOrder(id){try{const status=$('status-'+id).value;if(status==='paid'&&!confirm('Verify the UPI payment/UTR first. Approve this order and release one inventory key?'))return;await api('/api/admin/orders/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({status})});alert(status==='paid'?'Approved — inventory key released to customer.':status==='rejected'?'Order rejected.':'Order updated.');await loadAdmin()}catch(e){alert(e.message)}}
loadAdmin().catch(err=>{if(err?.message&&!String(err.message).includes('redirect'))alert(err.message)});
