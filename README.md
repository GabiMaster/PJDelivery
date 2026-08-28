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
7. Copiar `.env.example` como `.env` o exportar sus variables. Los scripts locales de npm cargan `.env` automáticamente; una ejecución alternativa con variables exportadas es:

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

## Despliegue: Firebase Hosting + Cloud Run

La imagen usa Node 22, instala únicamente dependencias de producción y arranca directamente `src/server.js`. No copia `.env`, credenciales, `secrets/`, datos SQLite, tests ni dependencias locales. Cloud Run inyecta `PORT` automáticamente y el servidor conserva `3000` como fallback local.

Requisitos:

- Google Cloud CLI y Firebase CLI autenticados.
- APIs de Cloud Run, Cloud Build, Artifact Registry y Firestore habilitadas.
- Proyecto Blaze seleccionado en ambas herramientas.

```bash
gcloud auth login
firebase login
gcloud config set project PROJECT_ID_REAL
firebase use --add

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com
```

### Cuenta de servicio

Se recomienda una identidad dedicada para el backend:

```bash
export PROJECT_ID="PROJECT_ID_REAL"
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

gcloud run deploy pj-delivery-backend \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --service-account="$RUN_SERVICE_ACCOUNT" \
  --set-env-vars="FIREBASE_PROJECT_ID=${PROJECT_ID},FIREBASE_WEB_API_KEY=${FIREBASE_WEB_API_KEY},STORE_NAME=PJ Delivery,TZ=America/Argentina/Cordoba"
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
firebase deploy --only hosting
```

Si `southamerica-east1` no estuviera habilitada para el proyecto, desplegar Cloud Run en `us-central1` y cambiar también `hosting.rewrites[0].run.region` en `firebase.json`; ambos valores deben coincidir.

Para versiones posteriores, repetir primero `gcloud run deploy ...` y luego `firebase deploy --only hosting` cuando hayan cambiado archivos del frontend o el rewrite.
