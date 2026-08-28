export function orderScope(user, requestedCashierUid) {
  if (!user?.uid) throw Object.assign(new Error('No autenticado'), { status: 401 });
  if (user.role === 'admin') return requestedCashierUid || null;
  if (requestedCashierUid && requestedCashierUid !== user.uid) throw Object.assign(new Error('No podés consultar pedidos de otro cajero'), { status: 403 });
  return user.uid;
}

export function requireCashier(user) {
  if (user.role !== 'cashier') throw Object.assign(new Error('Solo los cajeros pueden cargar pedidos o cerrar caja'), { status: 403 });
}

export function requireAdmin(user) {
  if (user.role !== 'admin') throw Object.assign(new Error('Esta acción requiere rol administrador'), { status: 403 });
}
