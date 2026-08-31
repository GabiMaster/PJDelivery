# POC: distancia automática de envío

Prueba aislada de Google Geocoding API + Routes API. No importa código de PJ Delivery, no usa Firebase y no modifica el formulario ni el cálculo de producción.

## Configuración

Requiere Node.js 22 o superior y una API key creada exclusivamente para esta evaluación.

1. En Google Maps Platform, habilitar **Geocoding API** y **Routes API**.
2. Crear una API key separada y restringirla por API únicamente a esos dos servicios. Como esta POC llama desde un servidor local, una restricción por sitio web no funcionará; si se cuenta con IP pública fija, restringir también por IP.
3. Copiar `.env.example` como `.env` y completar `GOOGLE_MAPS_API_KEY`.
4. Configurar el origen con coordenadas exactas (`STORE_LAT` y `STORE_LNG`, opción recomendada) o `STORE_ORIGIN`.

`TRAVEL_MODE` admite `DRIVE` (predeterminado) o `TWO_WHEELER`. Las direcciones siempre reciben el contexto de `ADDRESS_CONTEXT` para evitar coincidencias fuera de Resistencia.

## Uso

Formulario para comparar hasta 20 direcciones:

```bash
npm start
```

Abrir <http://localhost:3100>. La columna “Estimación manual” queda disponible para anotar la distancia calculada a ojo.

También puede probarse desde la terminal:

```bash
npm run cli -- "French 450" "Av. Sarmiento 1200"
```

La consola registra la dirección, las coordenadas y los indicadores de confianza, pero nunca la API key. Si Google devuelve `partial_match`, un resultado que no representa una dirección precisa o una ubicación `APPROXIMATE`, se informa `low_confidence` y no se consulta Routes API. Para evaluar igualmente esos casos puede configurarse `ALLOW_LOW_CONFIDENCE=true`.

Los errores de red, cuota, dirección inexistente y ruta no encontrada se devuelven por dirección sin detener las demás pruebas. La distancia de ruta se convierte con `cuadras = distanceMeters / 100`.

## Cuotas y presupuesto de la prueba

Valores iniciales sugeridos para una evaluación manual:

- Geocoding API: **100 solicitudes/día**.
- Routes API `ComputeRoutes`: **100 solicitudes/día**.
- Alerta de presupuesto: **USD 5**, con avisos al 50%, 90% y 100%.

Estas cuotas son un techo de seguridad contra loops, no una estimación de producción. Cien pruebas diarias dejan margen para ensayar direcciones sin exponer la key a un consumo descontrolado. La alerta solo notifica y no detiene el servicio. Antes de una integración real deben recalcularse las cuotas con al menos el doble del pico esperado de envíos y revisarse los precios vigentes.

Registrar aquí los valores efectivamente configurados:

| Control                | Valor configurado | Fecha      |
| ---------------------- | ----------------: | ---------- |
| Cuota diaria Geocoding |               100 | 28/08/2026 |
| Cuota diaria Routes    |               100 | 28/08/2026 |
| Alerta de presupuesto  |             USD 5 | 28/08/2026 |

## Evaluación

Para cada dirección conviene comparar precisión, confianza y distancia estimada manualmente. No integrar en PJ Delivery hasta revisar una muestra representativa de direcciones reales y aprobar explícitamente el resultado.

## Tests

```bash
npm test
```

Los tests no llaman a Google: simulan respuestas para validar conversión, contexto, confianza y cuota agotada.
