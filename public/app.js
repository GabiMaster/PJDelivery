const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
let people = { cashiers: [], couriers: [] }, config;

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación');
  return data;
}
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.className = `show${error ? ' error' : ''}`; setTimeout(() => el.className = '', 2800); }
function options(items, initial = '') { return `${initial}${items.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('')}`; }
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value ?? ''; return div.innerHTML; }
function payment(value) { return value === 'cash' ? 'Efectivo' : 'Transferencia'; }

async function loadPeople() {
  people = await request('/api/people');
  $('[name=cashierId]').innerHTML = options(people.cashiers);
  $('[name=courierId]').innerHTML = options(people.couriers, '<option value="">Sin asignar</option>');
  $('#filter-cashier').innerHTML = options(people.cashiers, '<option value="">Todos</option>');
  $('#filter-courier').innerHTML = options(people.couriers, '<option value="">Todos</option>');
  $('#cashier-list').innerHTML = people.cashiers.map(x => `<li>${escapeHtml(x.name)}</li>`).join('');
  $('#courier-list').innerHTML = people.couriers.map(x => `<li>${escapeHtml(x.name)}</li>`).join('');
}
async function updatePrice() {
  const form = $('#order-form'), delivery = form.deliveryMethod.value === 'delivery';
  $('#delivery-fields').classList.toggle('hidden', !delivery);
  const base = Math.round(Number(form.orderAmount.value) || 0); let shipping = 0;
  if (delivery) try { shipping = (await request(`/api/shipping?distance=${Number(form.distance.value) || 0}&unit=${form.distanceUnit.value}`)).cost; } catch {}
  $('#base-preview').textContent = money.format(base); $('#shipping-preview').textContent = money.format(shipping); $('#total-preview').textContent = money.format(base + shipping);
}
async function loadOrders() {
  const params = new URLSearchParams();
  if ($('#filter-date').value) params.set('date', $('#filter-date').value);
  if ($('#filter-cashier').value) params.set('cashierId', $('#filter-cashier').value);
  if ($('#filter-courier').value) params.set('courierId', $('#filter-courier').value);
  const rows = await request(`/api/orders?${params}`);
  $('#orders-table').innerHTML = rows.length ? `<table><thead><tr><th>Fecha / hora</th><th>Detalle</th><th>Cajero</th><th>Pago</th><th>Entrega</th><th>Delivery</th><th>Casa</th><th>Envío</th><th>Total</th></tr></thead><tbody>${rows.map(x => `<tr><td>${x.business_date}<br><span class="muted">${new Date(x.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span></td><td class="detail">${escapeHtml(x.description)}</td><td>${escapeHtml(x.cashier_name)}</td><td>${payment(x.payment_method)}</td><td>${x.delivery_method === 'delivery' ? `Envío<br><span class="muted">${escapeHtml(x.address)}</span>` : 'Retiro'}</td><td>${escapeHtml(x.courier_name || 'Sin asignar')}</td><td class="money">${money.format(x.order_amount)}</td><td>${money.format(x.shipping_cost)}</td><td class="money">${money.format(x.total_amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted" style="padding:24px">No hay pedidos para estos filtros.</p>';
}
async function loadPreview() {
  const data = await request(`/api/closures/preview?date=${$('#closure-date').value}`);
  const courierRows = data.couriers.map(x => `<div class="courier-row"><span>${escapeHtml(x.name)} <small class="muted">(${x.orders} envíos)</small></span><strong>${money.format(x.total)}</strong></div>`).join('');
  const missing = data.unassigned.count ? `<div class="courier-row"><span>Sin asignar <small class="muted">(${data.unassigned.count} envíos)</small></span><strong>${money.format(data.unassigned.total)}</strong></div>` : '';
  $('#closure-preview').innerHTML = `<div class="metric"><small>Efectivo</small><strong>${money.format(data.cash_total)}</strong></div><div class="metric"><small>Transferencias</small><strong>${money.format(data.transfer_total)}</strong></div><div class="metric"><small>Corresponde a caja</small><strong>${money.format(data.house_total)}</strong></div><div class="metric featured"><small>Total facturado · ${data.order_count} pedidos</small><strong>${money.format(data.grand_total)}</strong></div><div class="card courier-summary"><h3>Rendición por delivery</h3>${courierRows || '<p class="muted">Sin deliveries asignados.</p>'}${missing}<p class="muted">Cajeros: ${data.cashiers.map(escapeHtml).join(', ') || 'Sin actividad'}</p></div>`;
}
async function loadClosures() {
  const rows = await request('/api/closures');
  $('#closures-table').innerHTML = rows.length ? `<table><thead><tr><th>Jornada</th><th>Generado</th><th>Pedidos</th><th>Efectivo</th><th>Transferencia</th><th>Total</th><th></th></tr></thead><tbody>${rows.map(x => `<tr><td>${x.business_date}</td><td>${new Date(x.created_at).toLocaleString('es-AR')}</td><td>${x.order_count}</td><td>${money.format(x.cash_total)}</td><td>${money.format(x.transfer_total)}</td><td class="money">${money.format(x.grand_total)}</td><td><a href="/api/closures/${x.id}/pdf">Descargar PDF</a></td></tr>`).join('')}</tbody></table>` : '<p class="muted" style="padding:24px">Todavía no se generaron cierres.</p>';
}
$$('nav button').forEach(button => button.onclick = async () => { $$('nav button,.view').forEach(x => x.classList.remove('active')); button.classList.add('active'); $(`#view-${button.dataset.view}`).classList.add('active'); if(button.dataset.view==='orders') await loadOrders(); if(button.dataset.view==='closure'){await loadPreview();await loadClosures();} });
$('#order-form').addEventListener('input', updatePrice);
$('#order-form').onsubmit = async event => { event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form)); try { await request('/api/orders', { method:'POST', body:JSON.stringify(data) }); toast('Pedido guardado correctamente'); const cashier=form.cashierId.value,date=form.businessDate.value; form.reset(); form.cashierId.value=cashier; form.businessDate.value=date; await updatePrice(); } catch(e){toast(e.message,true);} };
['filter-date','filter-cashier','filter-courier'].forEach(id => $(`#${id}`).onchange=loadOrders);
$('#filter-clear').onclick=()=>{ $('#filter-date').value='';$('#filter-cashier').value='';$('#filter-courier').value='';loadOrders(); };
$('#closure-date').onchange=loadPreview;
$('#close-register').onclick=async()=>{ try { const data=await request('/api/closures',{method:'POST',body:JSON.stringify({businessDate:$('#closure-date').value})}); toast('Cierre guardado. El PDF ya está disponible.'); await loadClosures(); window.location.href=`/api/closures/${data.id}/pdf`; }catch(e){toast(e.message,true);} };
for (const type of ['cashier','courier']) $(`#${type}-form`).onsubmit=async event=>{event.preventDefault();try{await request(`/api/${type}s`,{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});event.currentTarget.reset();await loadPeople();toast('Personal agregado');}catch(e){toast(e.message,true);}};

config = await request('/api/config'); $('#store-name').textContent=config.storeName; $('#header-date').textContent=new Date(`${config.today}T12:00:00`).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'}); $('[name=businessDate]').value=config.today; $('#closure-date').value=config.today; await loadPeople(); await updatePrice();
