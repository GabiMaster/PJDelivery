export const CHANGE_FUND_TARGET=100000;

export function changeFundBalanceAfter(balance,type,amount){
  const current=Number(balance),value=Number(amount);
  if(!Number.isFinite(current)||!Number.isInteger(value)||value<=0)throw new TypeError('Movimiento de vuelto inválido');
  if(type==='reintegro')return current+value;
  if(['permanente','vuelto_cliente'].includes(type))return current-value;
  throw new TypeError('Tipo de movimiento de vuelto inválido');
}

export function courierSettlements(orders){
  const result=new Map();
  for(const order of orders){if(order.deliveryMethod!=='delivery'||!order.courierId)continue;const row=result.get(order.courierId)||{id:order.courierId,name:order.courierName||'Delivery',orders:0,toRender:0,earnings:0,netToCash:0};row.orders++;row.earnings+=Number(order.shippingCost)||0;if(order.paymentMethod==='cash')row.toRender+=Number(order.totalAmount)||0;row.netToCash=row.toRender-row.earnings;result.set(order.courierId,row)}
  return [...result.values()].sort((a,b)=>a.name.localeCompare(b.name));
}

export function cashSummary(orders,movements){
  const grossCash=orders.reduce((sum,order)=>sum+(order.paymentMethod==='cash'?(Number(order.totalAmount)||0):0),0);
  const pickupCash=orders.reduce((sum,order)=>sum+(order.deliveryMethod==='pickup'&&order.paymentMethod==='cash'?(Number(order.totalAmount)||0):0),0);
  const courierNetCash=courierSettlements(orders).reduce((sum,row)=>sum+row.netToCash,0);
  const permanentExpenses=movements.filter(x=>x.type==='permanente').reduce((sum,x)=>sum+(Number(x.amount)||0),0);
  const customerChange=movements.filter(x=>x.type==='vuelto_cliente').reduce((sum,x)=>sum+(Number(x.amount)||0),0);
  const totalWithdrawals=permanentExpenses+customerChange;
  const cashBeforeReplenishment=pickupCash+courierNetCash,netCash=cashBeforeReplenishment-permanentExpenses,physicalCashAfterReplenishment=netCash-customerChange;
  return {grossCash,pickupCash,courierNetCash,permanentExpenses,customerChange,cashBeforeReplenishment,netCash,physicalCashAfterReplenishment,changeFundTarget:CHANGE_FUND_TARGET,totalWithdrawals,changeFundBeforeReplenishment:CHANGE_FUND_TARGET-totalWithdrawals,replenishmentNeeded:totalWithdrawals,projectedChangeFundFinal:CHANGE_FUND_TARGET};
}
