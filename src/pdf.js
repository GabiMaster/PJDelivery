const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function escapePdf(text) {
  return String(text).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)').replaceAll(/[áàä]/gi, 'a').replaceAll(/[éèë]/gi, 'e').replaceAll(/[íìï]/gi, 'i').replaceAll(/[óòö]/gi, 'o').replaceAll(/[úùü]/gi, 'u').replaceAll(/ñ/gi, 'n');
}

export function closurePdf(closure) {
  const cashiers = JSON.parse(closure.cashiers_json);
  const couriers = JSON.parse(closure.couriers_json);
  const cash = closure.cash || {};
  const movements = closure.movements || [];
  const physicalCashFinal = cash.physicalCashAfterReplenishment ?? 0;
  const lines = [
    closure.store_name,
    `Cierre de caja - ${closure.business_date}`,
    `Generado: ${new Date(closure.created_at).toLocaleString('es-AR')}`,
    '',
    `Cajeros: ${cashiers.join(', ') || 'Sin actividad'}`,
    `Pedidos registrados: ${closure.order_count}`,
    '',
    `Transferencias: ${money.format(closure.transfer_total)}`,
    `Total facturado: ${money.format(closure.grand_total)}`,
    `Corresponde a caja: ${money.format(closure.house_total)}`,
    `Total vendido en efectivo (informativo): ${money.format(cash.grossCash || 0)}`,
    `Efectivo en caja antes del reintegro: ${money.format(cash.cashBeforeReplenishment ?? 0)}`,
    `Egresos permanentes: ${money.format(cash.permanentExpenses || 0)}`,
    `Egresos por vuelto a clientes: ${money.format(cash.customerChange || 0)}`,
    `Efectivo fisico final en caja: ${money.format(physicalCashFinal)}`,
    ...(closure.changeFundBalance != null ? [`Saldo real del vuelto al cerrar: ${money.format(closure.changeFundBalance)}`] : []),
    `Reposicion necesaria: ${money.format(cash.replenishmentNeeded || 0)}`,
    '',
    'Rendicion por delivery:',
    ...couriers.map(item => {const legacy=item.netToCash===undefined,rendered=legacy?(Number(item.toRender||item.total)||0)+(Number(item.earnings)||0)-(Number(item.toPay)||0):Number(item.toRender)||0,net=legacy?(Number(item.toRender||item.total)||0)-(Number(item.toPay)||0):Number(item.netToCash)||0;return `${item.name}: rinde ${money.format(rendered)}, ganancia ${money.format(item.earnings || 0)}, ${net < 0 ? `caja debe pagarle ${money.format(Math.abs(net))}` : `queda en caja ${money.format(net)}`} (${item.orders} envios)`}),
    ...(couriers.length ? [] : ['Sin deliveries asignados']),
    '',
    'Retiros del fondo de vuelto:',
    ...movements.map(item => `${item.type === 'permanente' ? 'Egreso' : 'Vuelto'}: ${item.note} - ${money.format(item.amount)}`),
    ...(movements.length ? [] : ['Sin retiros registrados'])
  ];
  const commands = ['BT', '/F1 18 Tf', '50 790 Td'];
  lines.forEach((line, index) => {
    if (index === 1) commands.push('/F1 14 Tf');
    if (index === 2) commands.push('/F1 10 Tf');
    commands.push(`(${escapePdf(line)}) Tj`, '0 -24 Td');
  });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'binary');
}
