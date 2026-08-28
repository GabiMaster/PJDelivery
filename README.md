# PJ Delivery

Aplicación web local para registrar pedidos, separar importes de caja y delivery, consultar el historial y generar cierres diarios en PDF.

## Requisitos y ejecución

- Node.js 22.5 o superior (se recomienda Node 24).
- No requiere instalar dependencias ni servicios externos.

```bash
npm start
```

Abrir <http://localhost:3000>. La base SQLite se crea automáticamente en `data/pjdelivery.db`.

Para desarrollo con recarga automática y para ejecutar los tests:

```bash
npm run dev
npm test
```

Variables opcionales:

```bash
STORE_NAME="Mi Pizzería" PORT=3000 TZ="America/Argentina/Cordoba" npm start
```

## Decisiones técnicas

- **Backend:** servidor HTTP nativo de Node, con una API JSON pequeña y sin dependencias de terceros.
- **Base de datos:** SQLite mediante `node:sqlite`; es apropiada para una caja local, persiste el historial y no requiere administrar otro servidor.
- **Frontend:** SPA liviana en HTML, CSS y JavaScript nativo, optimizada para que la carga cotidiana requiera pocos clics.
- **PDF:** generado en el servidor como un documento PDF breve, compuesto únicamente por los totales del snapshot.
- **Dinero:** se guarda en pesos enteros para evitar errores de coma flotante.
- **Jornada:** cada pedido tiene `business_date`, separada de su timestamp real. Esto permite cargar o corregir pedidos de una jornada concreta.

## Modelo de datos

- `cashiers` y `couriers`: personal activo, preparado para incorporar usuarios/login más adelante.
- `orders`: registro permanente con importes de la casa, envío y total; dirección, teléfono, distancia y delivery son específicos de los envíos.
- `cash_closures`: snapshot independiente con totales por pago, caja, cajeros y deliveries. Generar otro cierre no modifica los anteriores.

La tarifa se implementa en `src/shipping.js` de forma aislada. Los tests incluyen 5,1 km = 51 cuadras, envío de $7.320 y total de $35.320 para un pedido de $28.000, además de los casos borde solicitados.
