export const ORDER_STATUSES = ['recibido','en_preparacion','listo','entregado','cancelado'];
const NEXT_STATUS = { recibido:'en_preparacion', en_preparacion:'listo', listo:'entregado' };

export function missingForTransition(order, nextStatus) {
  const missing=[];
  if(order.status==='recibido'&&nextStatus==='en_preparacion'){
    if(!String(order.customerName||'').trim())missing.push('nombre del cliente');
    if(!Array.isArray(order.items)||!order.items.length)missing.push('ítems del pedido');
    if(!['pickup','delivery'].includes(order.deliveryMethod))missing.push('forma de entrega');
    if(!['cash','transfer'].includes(order.paymentMethod))missing.push('método de pago');
  }
  if(order.status==='en_preparacion'&&nextStatus==='listo'&&order.deliveryMethod==='delivery'&&!order.courierId)missing.push('delivery asignado');
  return missing;
}

export function validateStatusTransition(order,nextStatus){
  if(!ORDER_STATUSES.includes(nextStatus))throw new TypeError('Estado inválido');
  if(nextStatus==='cancelado'){if(['entregado','cancelado'].includes(order.status))throw new TypeError('El pedido ya está finalizado');return;}
  if(NEXT_STATUS[order.status]!==nextStatus)throw new TypeError('Transición de estado inválida');
  const missing=missingForTransition(order,nextStatus);
  if(missing.length)throw new TypeError(`Falta completar: ${missing.join(', ')}`);
}

export const isActiveOrder = order => !['entregado','cancelado'].includes(order.status||'recibido');
export const nextOrderStatus = status => NEXT_STATUS[status]||null;
