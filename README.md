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
- Para envíos, Google Maps propone la distancia real por calle; el cajero siempre puede reemplazarla manualmente.
- La carta pública muestra precios e ingredientes activos sin requerir login.
- El tablero de la jornada actualiza cada siete segundos y organiza el flujo `recibido → en preparación → listo → entregado`.
- Los pedidos recibidos pueden guardarse incompletos y editarse en cualquier estado; los datos obligatorios se validan al avanzar.
- Los cierres incluyen rendición de deliveries, movimientos del fondo de vuelto y efectivo neto.

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
7. Copiar `.env.example` como `.env` o exportar sus variables. Los scripts locales de npm cargan `.env` automáticamente; una ejecución alternativa con variables exportadas es:

```bash
export FIREBASE_PROJECT_ID="mi-proyecto"
export FIREBASE_WEB_API_KEY="API_KEY_DE_FIREBASE"
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
export FIREBASE_WEB_API_KEY="API_KEY_DE_FIREBASE"
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

Colecciones: `cashiers`, `couriers`, `menuItems`, `orders`, `cashMovements`, `changeFundReimbursements`, `settings` y `cashClosures`. SQLite ya no se utiliza y los datos de prueba anteriores no se migran.

## Tests

```bash
npm test
```

Cubren la tarifa vigente, el cálculo del monto desde ítems, el flujo de estados, la liquidación de deliveries, el fondo de vuelto y la restricción que impide a un cajero consultar la caja de otro.

## Tablero, rendiciones y fondo de vuelto

Cada cajero ve únicamente sus pedidos activos del día. El administrador puede consultar el tablero de un cajero, pero no modificarlo. Los pedidos entregados o cancelados salen del tablero y siguen disponibles en el historial, con filtros por entrega, pago y delivery.

La jornada actual del tablero se determina en el backend en cada actualización, por lo que al cambiar el día los pedidos anteriores desaparecen del tablero sin borrarse. El historial conserva todos los pedidos y permite avanzar o cancelar su estado, incluso en jornadas anteriores, aplicando las mismas validaciones de completitud.

El tablero navega entre `Recibido`, `En preparación`, `Listo / En camino` y `Entregado`, mostrando una sola sección por vez. La búsqueda por cliente y los filtros de entrega, pago y delivery se combinan dentro de la sección activa; únicamente los cancelados quedan fuera del tablero.

El monto rendido por cada delivery es todo lo que recaudó en efectivo (pedido más envío). El cierre descuenta de ese monto su ganancia total por todos los envíos y muestra un único saldo neto: si es positivo queda en caja; si es negativo, caja debe pagarle su valor absoluto al delivery.

El “total vendido en efectivo” se muestra únicamente como referencia. El efectivo neto físico se calcula sumando los retiros pagados en efectivo y el saldo neto de todos los deliveries, y restando los egresos permanentes. El `vuelto_cliente` sigue siendo neutro.

Antes de reponer el fondo, el cierre muestra el efectivo físico que debería encontrarse en caja: retiros pagados en efectivo más los saldos netos de deliveries, sin descontar todavía ningún egreso. También informa el efectivo físico final luego de reintegrar al fondo tanto los egresos permanentes como los vueltos entregados a clientes.

El fondo objetivo de vuelto es de **$100.000**, pero su saldo real queda persistido en `settings/changeFund` y no se reinicia entre jornadas o cierres. Cada retiro `permanente` o `vuelto_cliente` lo reduce atómicamente; cada reintegro registrado lo incrementa por el monto exacto. El vuelto entregado al cliente sigue siendo neutro en el efectivo neto.

La tarifa de envío es de **$1.700 hasta 10 cuadras**. Para distancias mayores se suman **$120 por cada cuadra que exceda las primeras 10**. Por ejemplo, 51 cuadras cuestan `$1.700 + 41 × $120 = $6.620`.

## Carga inicial de la carta

`scripts/seed-menu.js` valida y carga `carta-seed.json` en `menuItems`, conservando la categoría y completando `description` con los ingredientes conocidos. Es idempotente: al volver a ejecutarlo actualiza los documentos con el mismo nombre en vez de duplicarlos.

El archivo se busca por defecto como `../carta-seed.json`. También se puede pasar otra ruta:

```bash
npm run seed:menu:check
npm run seed:menu -- /ruta/a/carta-seed.json
```

El primer comando solo valida. El segundo escribe en el proyecto o emulador configurado en `.env`; actualiza precio, tipo, categoría y estado, pero no elimina otros ítems existentes.

## Despliegue: Firebase Hosting + Cloud Run

La imagen usa Node 22, instala únicamente dependencias de producción y arranca directamente `src/server.js`. No copia `.env`, credenciales, `secrets/`, datos SQLite, tests ni dependencias locales. Cloud Run inyecta `PORT` automáticamente y el servidor conserva `3000` como fallback local.

Requisitos:

- Google Cloud CLI y Firebase CLI autenticados.
- APIs de Cloud Run, Cloud Build, Artifact Registry y Firestore habilitadas.
- Proyecto Blaze seleccionado en ambas herramientas.

```bash
gcloud auth login
firebase login
gcloud config set project pjdelivery-3d5de
firebase use pjdelivery-3d5de

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  geocoding-backend.googleapis.com \
  routes.googleapis.com
```

### Cuenta de servicio

Se recomienda una identidad dedicada para el backend:

```bash
export PROJECT_ID="pjdelivery-3d5de"
export RUN_SERVICE_ACCOUNT="pj-delivery-runner@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create pj-delivery-runner \
  --display-name="PJ Delivery Cloud Run"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SERVICE_ACCOUNT}" \
  --role="roles/datastore.user"
```

`roles/datastore.user` permite leer y escribir Firestore. `verifyIdToken()` valida firmas públicas y no necesita permisos para administrar usuarios de Firebase Auth. Solo si más adelante el backend crea, elimina o modifica cuentas, agregar `roles/firebaseauth.admin`:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SERVICE_ACCOUNT}" \
  --role="roles/firebaseauth.admin"
```

### Publicar el backend

Obtener la API key de la aplicación web desde Firebase Console → Configuración del proyecto. No es una clave privada, pero el login la necesita:

```bash
export FIREBASE_WEB_API_KEY="API_KEY_DE_FIREBASE"
export GOOGLE_MAPS_API_KEY="API_KEY_EXCLUSIVA_DE_PRODUCCION"
export STORE_LAT="-27.47792347295175"
export STORE_LNG="-58.98525095941216"
export ADDRESS_CONTEXT="Resistencia, Chaco, Argentina"
export PROJECT_ID="pjdelivery-3d5de"
export RUN_SERVICE_ACCOUNT="pj-delivery-runner@pjdelivery-3d5de.iam.gserviceaccount.com"

gcloud run deploy pj-delivery-backend \
  --source . \
  --project pjdelivery-3d5de \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --service-account="$RUN_SERVICE_ACCOUNT" \
  --set-env-vars="^@^FIREBASE_PROJECT_ID=${PROJECT_ID}@FIREBASE_WEB_API_KEY=${FIREBASE_WEB_API_KEY}@GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}@STORE_LAT=${STORE_LAT}@STORE_LNG=${STORE_LNG}@ADDRESS_CONTEXT=${ADDRESS_CONTEXT}@TRAVEL_MODE=TWO_WHEELER@STORE_NAME=PJ Delivery@TZ=America/Argentina/Cordoba"
```

Las variables de producción se administran en Cloud Run, nunca mediante `.env` ni archivos de cuenta de servicio dentro de la imagen. El Admin SDK utiliza automáticamente las credenciales de la cuenta asignada al servicio.

Comprobar el backend usando la URL informada por el despliegue:

```bash
curl "https://URL_DEL_SERVICIO/api/health"
```

Debe responder `{"status":"ok"}`.

### Publicar Firebase Hosting

[`firebase.json`](./firebase.json) sirve `public/` desde Hosting y reescribe las demás rutas hacia `pj-delivery-backend` en `southamerica-east1`:

```bash
firebase deploy --only hosting --project pjdelivery-3d5de
```

Si `southamerica-east1` no estuviera habilitada para el proyecto, desplegar Cloud Run en `us-central1` y cambiar también `hosting.rewrites[0].run.region` en `firebase.json`; ambos valores deben coincidir.

Para versiones posteriores, repetir primero `gcloud run deploy ...` y luego `firebase deploy --only hosting` cuando hayan cambiado archivos del frontend o el rewrite.

## Distancia automática de envíos

El backend es el único componente que conoce `GOOGLE_MAPS_API_KEY` y llama a Geocoding API y Routes API. El navegador recibe metros, cuadras, confianza y tarifa, pero nunca la credencial. La key de producción debe ser distinta de la POC y estar restringida exclusivamente a esas dos APIs.

Flujo operativo:

- Una dirección precisa calcula automáticamente la ruta y el envío.
- Una coincidencia parcial, aproximada, error de red o cuota agotada habilita inmediatamente la carga manual.
- El cajero puede elegir “Ingresar distancia manualmente” antes o después del cálculo.
- Cada pedido guarda `distanceSource` (`auto` o `manual`) y, para cálculos automáticos, `distanceConfidence: high`.
- Los pedidos históricos sin estos campos siguen siendo compatibles.

Variables requeridas en Cloud Run: `GOOGLE_MAPS_API_KEY`, `STORE_LAT`, `STORE_LNG`, `ADDRESS_CONTEXT` y `TRAVEL_MODE`. Para desarrollo local pueden agregarse al `.env` usando [.env.example](./.env.example) como referencia.

### Control de costos aprobado para producción

Valores definidos el **2026-08-28** para un pico esperado de 50 a 100 envíos diarios:

| Control                             |               Valor |
| ----------------------------------- | ------------------: |
| Cuota diaria Geocoding API          | 300 solicitudes/día |
| Cuota diaria Routes `ComputeRoutes` | 300 solicitudes/día |
| Alerta de presupuesto               |              USD 10 |
| Umbrales de aviso                   |     50%, 90% y 100% |

Las cuotas deben configurarse en Google Maps Platform → Quotas y la alerta en Billing → Budgets & alerts. La alerta no detiene el servicio. Estos valores deben revisarse si cambia significativamente el volumen de pedidos.

## Catálogo público

La carta para clientes está disponible sin autenticación en:

```text
https://pjdelivery-3d5de.web.app/carta-publica
```

También se puede usar `/carta-publica` bajo un dominio personalizado. La página muestra únicamente productos activos con nombre, categoría, ingredientes y precio; no expone pedidos, cierres, cajeros, teléfonos ni deliveries. El backend conserva la consulta de Firestore en memoria durante cinco minutos y responde con `Cache-Control: public, max-age=300`.

Los ingredientes se actualizan de forma idempotente con:

```bash
npm run seed:menu
```

Para publicar cambios del catálogo, desplegar primero Cloud Run y luego Hosting usando los comandos completos de la sección anterior.
