const CACHE_SECONDS = 300;
const allowedFields = item => ({ name:String(item.name||''),price:Number(item.price)||0,type:item.type==='promo'?'promo':'food',category:String(item.category||'Otros'),description:item.description?String(item.description):(item.ingredients?String(item.ingredients):null) });
const escapeHtml = value => String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

export function createPublicMenuCache(loadItems,{ttlMs=CACHE_SECONDS*1000}={}) {
  let cached=null,expiresAt=0,pending=null;
  return async function getMenu(now=Date.now()) {
    if(cached&&now<expiresAt)return cached;
    if(!pending)pending=Promise.resolve(loadItems()).then(items=>{cached=items.filter(item=>item.active===true).map(allowedFields);expiresAt=Date.now()+ttlMs;return cached}).finally(()=>{pending=null});
    return pending;
  };
}

export function renderPublicMenu(items,storeName='PJ Delivery') {
  const groups=new Map();for(const item of items){if(!groups.has(item.category))groups.set(item.category,[]);groups.get(item.category).push(item)}
  const content=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'es')).map(([category,rows])=>`<section><h2>${escapeHtml(category)}</h2>${rows.sort((a,b)=>a.name.localeCompare(b.name,'es')).map(item=>`<article><div><h3>${escapeHtml(item.name)}</h3>${item.description?`<p>${escapeHtml(item.description)}</p>`:''}</div><strong>${new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(item.price)}</strong></article>`).join('')}</section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carta · ${escapeHtml(storeName)}</title><style>:root{font-family:system-ui;color:#20241f;background:#f6f3eb}body{max-width:760px;margin:auto;padding:28px 18px 60px}header{background:#244d3b;color:white;padding:24px;border-radius:16px}header p{color:#dce7df}h1{margin:0 0 6px}h2{margin:32px 0 10px;color:#244d3b}article{display:flex;justify-content:space-between;gap:18px;background:white;border:1px solid #dedfd8;border-radius:10px;padding:15px;margin:8px 0}h3{font-size:16px;margin:0 0 5px}p{font-size:14px;color:#697067;margin:0;line-height:1.4}strong{white-space:nowrap;color:#244d3b}@media(max-width:500px){article{align-items:flex-start}strong{font-size:14px}}</style></head><body><header><h1>${escapeHtml(storeName)}</h1><p>Carta actualizada · comidas y promociones disponibles</p></header>${content||'<p>No hay productos disponibles en este momento.</p>'}</body></html>`;
}

export async function servePublicMenu(res,getMenu,storeName) {
  const html=renderPublicMenu(await getMenu(),storeName);
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':`public, max-age=${CACHE_SECONDS}`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"});res.end(html);
}
