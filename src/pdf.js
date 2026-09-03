const money=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
const PAGE_WIDTH=595,PAGE_HEIGHT=842,MARGIN=42,CONTENT_WIDTH=PAGE_WIDTH-MARGIN*2;

function escapePdf(value){return String(value??'').replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)').replaceAll('\u00a0',' ').replaceAll(/[áàä]/gi,'a').replaceAll(/[éèë]/gi,'e').replaceAll(/[íìï]/gi,'i').replaceAll(/[óòö]/gi,'o').replaceAll(/[úùü]/gi,'u').replaceAll(/ñ/gi,'n')}
const formatMoney=value=>money.format(Number(value)||0);
const fill=(commands,color,x,y,width,height)=>commands.push(`${color} rg`,`${x} ${y} ${width} ${height} re f`);
const line=(commands,color,x1,y1,x2,y2,width=1)=>commands.push(`${color} RG`,`${width} w`,`${x1} ${y1} m ${x2} ${y2} l S`);
function text(commands,value,x,y,{size=9,bold=false,color='0.12 0.14 0.12',align='left',width=0}={}){const safe=escapePdf(value),estimated=safe.length*size*.5;let left=x;if(align==='right')left=x+width-estimated;if(align==='center')left=x+(width-estimated)/2;commands.push('BT',`${color} rg`,`/${bold?'F2':'F1'} ${size} Tf`,`${left} ${y} Td`,`(${safe}) Tj`,'ET')}

function table(commands,{title,y,columns,rows,highlightLast=false}){
  text(commands,title,MARGIN,y,{size:13,bold:true,color:'0.48 0.04 0.06'});y-=22;
  const headerHeight=24,rowHeight=23;
  fill(commands,'0.72 0.05 0.08',MARGIN,y-headerHeight,CONTENT_WIDTH,headerHeight);
  let x=MARGIN;for(const column of columns){text(commands,column.label,x+7,y-16,{size:8,bold:true,color:'1 1 1',align:column.align||'left',width:column.width-14});x+=column.width}y-=headerHeight;
  rows.forEach((row,index)=>{const highlighted=highlightLast&&index===rows.length-1;if(highlighted)fill(commands,'0.98 0.78 0.08',MARGIN,y-rowHeight,CONTENT_WIDTH,rowHeight);else if(index%2)fill(commands,'0.96 0.96 0.95',MARGIN,y-rowHeight,CONTENT_WIDTH,rowHeight);x=MARGIN;columns.forEach(column=>{const negative=column.negative&&Number(row[column.key])<0;text(commands,column.money?formatMoney(row[column.key]):row[column.key],x+7,y-15,{size:8.5,bold:highlighted||negative,color:negative?'0.72 0.05 0.08':'0.12 0.14 0.12',align:column.align||'left',width:column.width-14});x+=column.width});line(commands,'0.84 0.84 0.81',MARGIN,y-rowHeight,MARGIN+CONTENT_WIDTH,y-rowHeight,.5);y-=rowHeight});
  line(commands,'0.72 0.05 0.08',MARGIN,y,MARGIN+CONTENT_WIDTH,y,1);return y-30;
}

function courierRows(couriers){return couriers.map(item=>{const legacy=item.netToCash===undefined,rendered=legacy?(Number(item.toRender||item.total)||0)+(Number(item.earnings)||0)-(Number(item.toPay)||0):Number(item.toRender)||0,net=legacy?(Number(item.toRender||item.total)||0)-(Number(item.toPay)||0):Number(item.netToCash)||0;return {name:item.name,rendered,earnings:Number(item.earnings)||0,net}})}

export function closurePdf(closure){
  const cashiers=JSON.parse(closure.cashiers_json),couriers=JSON.parse(closure.couriers_json),cash=closure.cash||{},movements=closure.movements||[],commands=[];
  const physicalCashFinal=Number(cash.physicalCashAfterReplenishment)||0,transferTotal=Number(closure.transfer_total)||0,netDayTotal=physicalCashFinal+transferTotal;
  fill(commands,'0.72 0.05 0.08',0,PAGE_HEIGHT-118,PAGE_WIDTH,118);fill(commands,'0.98 0.78 0.08',0,PAGE_HEIGHT-126,PAGE_WIDTH,8);
  text(commands,closure.store_name,MARGIN,798,{size:20,bold:true,color:'1 1 1'});text(commands,'CIERRE DE CAJA',MARGIN,771,{size:14,bold:true,color:'0.98 0.78 0.08'});
  text(commands,`Jornada: ${closure.business_date}`,MARGIN,744,{size:9,color:'1 1 1'});text(commands,`Generado: ${new Date(closure.created_at).toLocaleString('es-AR')}`,290,744,{size:9,color:'1 1 1'});
  text(commands,`Cajero: ${cashiers.join(', ')||'Sin actividad'}`,MARGIN,728,{size:9,bold:true,color:'1 1 1'});text(commands,`Pedidos registrados: ${closure.order_count}`,385,728,{size:9,bold:true,color:'1 1 1'});
  let y=684;
  y=table(commands,{title:'Resumen general',y,columns:[{key:'label',label:'Concepto',width:356},{key:'amount',label:'Monto',width:155,money:true,align:'right'}],rows:[
    {label:'Total vendido en efectivo (informativo)',amount:cash.grossCash||0},
    {label:'Efectivo en caja antes del reintegro',amount:cash.cashBeforeReplenishment||0},
    {label:'Efectivo físico final en caja',amount:physicalCashFinal},
    {label:'Total transferencias',amount:transferTotal},
    {label:'TOTAL NETO DEL DIA',amount:netDayTotal}
  ],highlightLast:true});
  const deliveryRows=courierRows(couriers);
  if(deliveryRows.length)y=table(commands,{title:'Rendicion por delivery',y,columns:[{key:'name',label:'Delivery',width:196},{key:'rendered',label:'Rinde',width:105,money:true,align:'right'},{key:'earnings',label:'Ganancia',width:105,money:true,align:'right'},{key:'net',label:'Queda en caja',width:105,money:true,align:'right',negative:true}],rows:deliveryRows});
  else{text(commands,'Rendicion por delivery',MARGIN,y,{size:13,bold:true,color:'0.48 0.04 0.06'});text(commands,'Sin envios con delivery asignado en este periodo.',MARGIN,y-23,{size:9,color:'0.38 0.4 0.38'});y-=58}
  const permanent=movements.filter(item=>item.type==='permanente').reduce((sum,item)=>sum+(Number(item.amount)||0),0),customerChange=movements.filter(item=>item.type==='vuelto_cliente').reduce((sum,item)=>sum+(Number(item.amount)||0),0),fundRows=[];
  if(permanent||customerChange){fundRows.push({label:'Egresos permanentes',amount:permanent},{label:'Vuelto a cliente',amount:customerChange},{label:'Reintegro necesario',amount:cash.replenishmentNeeded||0})}fundRows.push({label:'Saldo final del vuelto en caja',amount:closure.changeFundBalance||0});
  table(commands,{title:'Retiros del vuelto en caja',y,columns:[{key:'label',label:'Concepto',width:356},{key:'amount',label:'Monto',width:155,money:true,align:'right'}],rows:fundRows});
  text(commands,'PJ Delivery · cierre generado por el sistema',MARGIN,24,{size:7,color:'0.5 0.5 0.48'});
  return buildPdf(commands.join('\n'));
}

function buildPdf(stream){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];let output='%PDF-1.4\n';const offsets=[0];objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(output));output+=`${index+1} 0 obj\n${object}\nendobj\n`});const xref=Buffer.byteLength(output);output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;output+=offsets.slice(1).map(value=>`${String(value).padStart(10,'0')} 00000 n \n`).join('');output+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(output,'binary')}
