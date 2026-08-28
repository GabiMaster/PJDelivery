export function calculateItemsTotal(items) {
  if (!Array.isArray(items) || items.length === 0) throw new TypeError('Agregá al menos un ítem al pedido');
  return items.reduce((total, item) => {
    const name = String(item.name || '').trim();
    const unitPrice = Number(item.unitPrice);
    const quantity = Number(item.quantity);
    if (!name) throw new TypeError('Cada ítem debe tener un nombre');
    if (!Number.isInteger(unitPrice) || unitPrice < 0) throw new TypeError('El precio debe ser un entero mayor o igual a cero');
    if (!Number.isInteger(quantity) || quantity < 1) throw new TypeError('La cantidad debe ser un entero mayor a cero');
    return total + unitPrice * quantity;
  }, 0);
}

export function snapshotItems(items) {
  calculateItemsTotal(items);
  return items.map(item => ({
    menuItemId: item.menuItemId || null,
    name: String(item.name).trim(),
    unitPrice: Number(item.unitPrice),
    quantity: Number(item.quantity),
    subtotal: Number(item.unitPrice) * Number(item.quantity),
    isCustom: !item.menuItemId
  }));
}
