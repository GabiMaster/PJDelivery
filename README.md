# PJ Delivery

Sistema web para pedidos, carta, deliveries y cierres personales de caja. Usa Firebase Authentication para identificar cajeros/administradores y Firestore como única persistencia.

## Funcionalidad

- Los cajeros ingresan con email y contraseña, cargan pedidos y solo ven sus pedidos y cierres.
- Cada cierre es un snapshot independiente por `cashierUid + businessDate`.
- El administrador consulta todos los cajeros y gestiona la carta y deliveries, pero no carga pedidos ni genera cierres.
- La carta admite comidas y promos, edición, baja lógica y reactivación.
- Un pedido contiene varios ítems con cantidad, más ítems libres excepcionales.
- Nombre, precio unitario, cantidad y subtotal quedan copiados en el pedido: cambiar la carta no altera ventas históricas.
- El envío, la separación caja/delivery y los PDF conservan la lógica original.

## Configuración de Firebase

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. En **Authentication → Sign-in method**, habilitar Email/Password.
3. Crear una base Firestore.
4. Crear las cuentas en **Authentication → Users**. No existe registro público en la app.
5. Por cada usuario, crear manualmente el documento `cashiers/{UID}`:

```json
{
  "name": "Nombre visible",
  "email": "cajero@local.com",
  "role": "cashier",
  "active": true
}
```

Para el dueño usar `"role": "admin"`. El documento debe usar exactamente el UID de Firebase Authentication.

6. En **Project settings → Service accounts**, generar una clave privada y guardarla fuera del repositorio.
7. Copiar `.env.example` como `.env` o exportar sus variables. Node no carga `.env` automáticamente; una ejecución típica es:

```bash
export FIREBASE_PROJECT_ID="mi-proyecto"
export FIREBASE_WEB_API_KEY="api-key-de-la-app-web"
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/segura/service-account.json"
npm install
npm start
```

Abrir <http://localhost:3000>. Las claves privadas están ignoradas por Git.

## Emuladores para desarrollo

Con Firebase CLI instalado:

```bash
firebase emulators:start --only auth,firestore
```

En otra terminal:

```bash
export FIREBASE_PROJECT_ID="pj-delivery-local"
export FIREBASE_WEB_API_KEY="cualquier-valor-no-vacio"
export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
npm start
```

Crear usuarios y sus documentos `cashiers/{UID}` desde Emulator UI, normalmente en <http://localhost:4000>. Con `FIREBASE_AUTH_EMULATOR_HOST`, tanto el inicio de sesión como la verificación de tokens usan automáticamente el emulador.

## Seguridad y arquitectura

El navegador solo utiliza la API del servidor. El backend verifica cada Firebase ID token y obtiene el perfil/rol desde `cashiers/{UID}` antes de operar:

- Un cajero queda forzado a su propio UID aunque intente enviar otro.
- Un administrador puede seleccionar un cajero para consultar pedidos/cierres.
- Solo administradores modifican `menuItems` y `couriers`.
- Solo cajeros crean pedidos y cierres.

Las [reglas de Firestore](./firestore.rules) niegan todo acceso cliente porque el Admin SDK es el único intermediario autorizado.

Colecciones: `cashiers`, `couriers`, `menuItems`, `orders` y `cashClosures`. SQLite ya no se utiliza y los datos de prueba anteriores no se migran.

## Tests

```bash
npm test
```

Cubren la tarifa original, el cálculo del monto desde ítems y la restricción que impide a un cajero consultar la caja de otro.

## Carga inicial de la carta

`scripts/seed-menu.js` valida y carga `carta-seed.json` en `menuItems`, conservando la categoría. Es idempotente: al volver a ejecutarlo actualiza los documentos con el mismo nombre en vez de duplicarlos.

El archivo se busca por defecto como `../carta-seed.json`. También se puede pasar otra ruta:

```bash
npm run seed:menu:check
npm run seed:menu -- /ruta/a/carta-seed.json
```

El primer comando solo valida. El segundo escribe en el proyecto o emulador configurado en `.env`; actualiza precio, tipo, categoría y estado, pero no elimina otros ítems existentes.
