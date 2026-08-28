import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticatedUser, firestore } from './firebase.js';
import { orderScope, requireAdmin, requireCashier } from './access.js';
import { calculateItemsTotal, snapshotItems } from './order.js';
import { calculateShippingCost, kilometersToBlocks } from './shipping.js';
import { closurePdf } from './pdf.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = join(root, 'public');
const port = Number(process.env.PORT || 3000);
const storeName = process.env.STORE_NAME || 'PJ Delivery';
const apiKey = process.env.FIREBASE_WEB_API_KEY || '';
const timeZone = process.env.TZ || 'America/Argentina/Cordoba';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
async function body(req) { const chunks=[]; for await (const chunk of req) chunks.push(chunk); if (!chunks.length) return {}; try{return JSON.parse(Buffer.concat(chunks));}catch{throw Object.assign(new Error('JSON inválido'),{status:400});} }
const docs = snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

async function signIn(email, password) {
  if (!apiKey) throw Object.assign(new Error('Falta configurar FIREBASE_WEB_API_KEY'), { status: 503 });
  const identityBase = process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`
    : 'https://identitytoolkit.googleapis.com/v1';
  const response = await fetch(`${identityBase}/accounts:signInWithPassword?key=${apiKey}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password,returnSecureToken:true}) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error('Email o contraseña incorrectos'), { status: 401 });
  return { idToken:data.idToken, refreshToken:data.refreshToken, expiresIn:Number(data.expiresIn) };
}

async function listOrders(user, params) {
  const scope = orderScope(user, params.get('cashierUid'));
  let query = firestore.collection('orders');
  if (scope) query = query.where('cashierUid','==',scope);
  let rows = docs(await query.get());
  if (params.get('date')) rows=rows.filter(x=>x.businessDate===params.get('date'));
  if (params.get('courierId')) rows=rows.filter(x=>x.courierId===params.get('courierId'));
  return rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,500);
}

async function preview(user, date, requestedUid) {
  const cashierUid = orderScope(user, requestedUid);
  if (!cashierUid) throw Object.assign(new Error('Seleccioná un cajero para ver su cierre'),{status:400});
  const rows = docs(await firestore.collection('orders').where('cashierUid','==',cashierUid).get()).filter(x=>x.businessDate===date);
  const profile = (await firestore.collection('cashiers').doc(cashierUid).get()).data();
  const result={ businessDate:date,cashierUid,cashierName:profile?.name||'Cajero',orderCount:rows.length,cashTotal:0,transferTotal:0,grandTotal:0,houseTotal:0,couriers:[],unassigned:{count:0,total:0} };
  const courierMap=new Map();
  for(const order of rows){result.grandTotal+=order.totalAmount;result.houseTotal+=order.orderAmount;result[order.paymentMethod==='cash'?'cashTotal':'transferTotal']+=order.totalAmount;if(order.deliveryMethod==='delivery'){if(order.courierId){const value=courierMap.get(order.courierId)||{id:order.courierId,name:order.courierName||'Delivery',orders:0,total:0};value.orders++;value.total+=order.shippingCost;courierMap.set(order.courierId,value);}else{result.unassigned.count++;result.unassigned.total+=order.shippingCost;}}}
  result.couriers=[...courierMap.values()].sort((a,b)=>a.name.localeCompare(b.name)); return result;
}

async function createOrder(user,input){
  requireCashier(user);
  if(!['cash','transfer'].includes(input.paymentMethod)||!['pickup','delivery'].includes(input.deliveryMethod))throw Object.assign(new Error('Método de pago o entrega inválido'),{status:400});
  const items=snapshotItems(input.items),orderAmount=calculateItemsTotal(items);let address=null,phone=null,distanceBlocks=null,shippingCost=0,courierId=null,courierName=null;
  if(input.deliveryMethod==='delivery'){if(!String(input.address||'').trim()||!String(input.phone||'').trim())throw Object.assign(new Error('Dirección y teléfono son obligatorios'),{status:400});const distance=Number(input.distance);if(!Number.isFinite(distance)||distance<0)throw Object.assign(new Error('Distancia inválida'),{status:400});distanceBlocks=input.distanceUnit==='km'?kilometersToBlocks(distance):distance;shippingCost=calculateShippingCost(distanceBlocks);address=input.address.trim();phone=input.phone.trim();if(input.courierId){const courier=await firestore.collection('couriers').doc(input.courierId).get();if(!courier.exists||courier.data().active===false)throw Object.assign(new Error('Delivery inválido'),{status:400});courierId=courier.id;courierName=courier.data().name;}}
  const businessDate=input.businessDate||today();if(!/^\d{4}-\d{2}-\d{2}$/.test(businessDate))throw Object.assign(new Error('Fecha inválida'),{status:400});
  const data={items,description:items.map(x=>`${x.quantity}× ${x.name}`).join(', '),orderAmount,paymentMethod:input.paymentMethod,deliveryMethod:input.deliveryMethod,address,phone,distanceBlocks,shippingCost,totalAmount:orderAmount+shippingCost,cashierUid:user.uid,cashierName:user.name,courierId,courierName,businessDate,createdAt:new Date().toISOString(),closedOn:null};
  const ref=await firestore.collection('orders').add(data);return{id:ref.id,...data};
}

async function api(req,res,url){
  if(req.method==='POST'&&url.pathname==='/api/auth/login'){const input=await body(req);return json(res,200,await signIn(input.email,input.password));}
  if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,{storeName,today:today(),firebaseConfigured:Boolean(apiKey)});
  const user=await authenticatedUser(req.headers.authorization);
  if(req.method==='GET'&&url.pathname==='/api/me')return json(res,200,user);
  if(req.method==='GET'&&url.pathname==='/api/cashiers'){requireAdmin(user);return json(res,200,docs(await firestore.collection('cashiers').get()).filter(x=>x.active!==false));}
  if(req.method==='GET'&&url.pathname==='/api/couriers')return json(res,200,docs(await firestore.collection('couriers').get()).filter(x=>x.active!==false).sort((a,b)=>a.name.localeCompare(b.name)));
  if(req.method==='POST'&&url.pathname==='/api/couriers'){requireAdmin(user);const input=await body(req),name=String(input.name||'').trim();if(!name)throw Object.assign(new Error('Ingresá un nombre'),{status:400});const ref=await firestore.collection('couriers').add({name,active:true,createdAt:new Date().toISOString()});return json(res,201,{id:ref.id,name,active:true});}
  if(req.method==='GET'&&url.pathname==='/api/menu') {const all=url.searchParams.get('all')==='1';if(all)requireAdmin(user);let rows=docs(await firestore.collection('menuItems').get());if(!all)rows=rows.filter(x=>x.active!==false);return json(res,200,rows.sort((a,b)=>a.name.localeCompare(b.name)));}
  if(req.method==='POST'&&url.pathname==='/api/menu'){requireAdmin(user);const input=await body(req),name=String(input.name||'').trim(),price=Number(input.price);if(!name||!Number.isInteger(price)||price<0||!['food','promo'].includes(input.type))throw Object.assign(new Error('Datos de carta inválidos'),{status:400});const data={name,price,type:input.type,active:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};const ref=await firestore.collection('menuItems').add(data);return json(res,201,{id:ref.id,...data});}
  const menuMatch=url.pathname.match(/^\/api\/menu\/([^/]+)$/);
  if(menuMatch&&req.method==='PATCH'){requireAdmin(user);const input=await body(req),ref=firestore.collection('menuItems').doc(menuMatch[1]),current=await ref.get();if(!current.exists)throw Object.assign(new Error('Ítem no encontrado'),{status:404});const update={updatedAt:new Date().toISOString()};if(input.name!==undefined)update.name=String(input.name).trim();if(input.price!==undefined)update.price=Number(input.price);if(input.type!==undefined)update.type=input.type;if(input.active!==undefined)update.active=Boolean(input.active);if((input.name!==undefined&&!update.name)||(update.price!==undefined&&(!Number.isInteger(update.price)||update.price<0))||(update.type&&!['food','promo'].includes(update.type)))throw Object.assign(new Error('Datos de carta inválidos'),{status:400});await ref.update(update);return json(res,200,{id:ref.id,...current.data(),...update});}
  if(req.method==='GET'&&url.pathname==='/api/orders')return json(res,200,await listOrders(user,url.searchParams));
  if(req.method==='POST'&&url.pathname==='/api/orders')return json(res,201,await createOrder(user,await body(req)));
  if(req.method==='GET'&&url.pathname==='/api/shipping'){const distance=Number(url.searchParams.get('distance')),blocks=url.searchParams.get('unit')==='km'?kilometersToBlocks(distance):distance;return json(res,200,{blocks,cost:calculateShippingCost(blocks)});}
  if(req.method==='GET'&&url.pathname==='/api/closures/preview')return json(res,200,await preview(user,url.searchParams.get('date')||today(),url.searchParams.get('cashierUid')));
  if(req.method==='GET'&&url.pathname==='/api/closures'){const scope=orderScope(user,url.searchParams.get('cashierUid'));let rows=docs(await firestore.collection('cashClosures').get());if(scope)rows=rows.filter(x=>x.cashierUid===scope);return json(res,200,rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}
  if(req.method==='POST'&&url.pathname==='/api/closures'){requireCashier(user);const input=await body(req),data=await preview(user,input.businessDate||today());const createdAt=new Date().toISOString(),closure={...data,storeName,createdAt};const id=`${user.uid}_${data.businessDate}_${Date.now()}`;await firestore.collection('cashClosures').doc(id).set(closure);return json(res,201,{id,...closure});}
  const pdfMatch=url.pathname.match(/^\/api\/closures\/([^/]+)\/pdf$/);
  if(req.method==='GET'&&pdfMatch){const snap=await firestore.collection('cashClosures').doc(pdfMatch[1]).get();if(!snap.exists)throw Object.assign(new Error('Cierre no encontrado'),{status:404});const value=snap.data();orderScope(user,value.cashierUid);const pdf=closurePdf({store_name:value.storeName,business_date:value.businessDate,created_at:value.createdAt,cashiers_json:JSON.stringify([value.cashierName]),couriers_json:JSON.stringify(value.couriers),cash_total:value.cashTotal,transfer_total:value.transferTotal,grand_total:value.grandTotal,house_total:value.houseTotal,order_count:value.orderCount});res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="cierre-${value.businessDate}.pdf"`});return res.end(pdf);}
  return json(res,404,{error:'Ruta no encontrada'});
}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
async function serveStatic(res, pathname) {
  const path = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (path.includes('..')) return json(res, 403, { error: 'Acceso denegado' });
  try {
    const file = await readFile(join(publicDir, path));
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    res.end(file);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return json(res, 404, { error: 'Archivo no encontrado' });
    throw error;
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    json(res, error.status || 500, { error: error.message || 'Error inesperado' });
  }
}).listen(port, () => console.log(`${storeName} disponible en http://localhost:${port}`));
