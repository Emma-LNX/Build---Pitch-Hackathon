# Registro diario antes de las lecciones

Antes de la primera lección, misión o expedición (diagnóstico) del día se muestran tres preguntas: horas de sueño de la noche anterior, si ya comió hoy y cómo se siente. Completar el formulario permite jugar durante ese día sin volver a preguntar. Volver al mapa sin responder no comienza la partida. No se interrumpe una partida en curso al cambiar de día.

Cada pregunta admite “Prefiero no responder”. Las respuestas no generan XP, no suman racha y no modifican la dificultad. No se interpretan como diagnósticos ni se muestran en el ranking o en las estadísticas de profesores/directores.

## Backend

La migración `V15__daily_check_ins.sql` crea `math_portal.registros_diarios`, con una fila por alumno y fecha. RLS y la revocación de permisos de cliente siguen el modelo del proyecto. No modificar las migraciones V1–V14 ya existentes.

Las rutas requieren un JWT válido y un perfil de alumno activo (`math_portal.alumnos`; las cuentas que crea el profesor ya lo tienen). La identidad siempre se resuelve desde el token; no se acepta `studentId`. El registro del día usa fecha del servidor; la ruta de sincronización admite explícitamente fechas autodeclaradas para conservar las respuestas offline.

- `GET /api/students/me/daily-check-in`: devuelve `{ date, required, checkIn }`. Sin registro para hoy, `required` es `true` y `checkIn` es `null`.
- `POST /api/students/me/daily-check-in`: registra las tres respuestas y devuelve `{ date, sleepHours, food, mood, timeZone, createdAt }`.
- `POST /api/students/me/daily-check-in/sync`: recibe `{ "date": "2026-11-21", "answers": { "sleepHours": 8, "food": "SUFICIENTE", "mood": "FELIZ" } }`. Permite hoy o fechas anteriores desde el año 2000; rechaza fechas futuras según la zona del alumno. La primera respuesta de cada fecha prevalece. Reintentos y conflictos entre dispositivos devuelven ese registro, sin duplicarlo. `createdAt` es el instante de recepción del servidor. Las fechas offline son autodeclaradas, no acreditan XP ni rachas.

```json
{
  "sleepHours": 8.5,
  "food": "SUFICIENTE",
  "mood": "TRANQUILO"
}
```

`sleepHours`: de 0 a 24, con un decimal como máximo; `null` significa que prefiere no responder, no cero horas. `food`: `SUFICIENTE`, `POCO`, `NO_HE_COMIDO`, `PREFIERO_NO_RESPONDER`. `mood`: `FELIZ`, `TRANQUILO`, `TRISTE`, `PREOCUPADO`, `CANSADO`, `PREFIERO_NO_RESPONDER`.

La fecha se calcula con el reloj del servidor y la zona IANA del alumno. El POST serializa las escrituras del alumno: repetir las mismas respuestas devuelve el registro existente y unas respuestas distintas para ese mismo día producen 409. Una respuesta inválida produce 400. No se exponen rutas para consultar respuestas ajenas.

## Interfaz y funcionamiento sin conexión

`DailyCheckInGate` envuelve las rutas `leccion/:lessonId`, `mision` y `diagnostico`. Primero busca el registro de hoy en el teléfono; si no lo hay y hay conexión, pregunta al servidor (pudo responder en otro teléfono) con un límite de pocos segundos. Sin conexión, sin sesión o si el servidor no responde, muestra el formulario: jugar nunca depende de tener internet.

Las respuestas se guardan en IndexedDB (`dailyCheckIns`, clave `[studentId, fecha]`, base `math-portal` v5) y la partida empieza de inmediato. El envío usa `/sync` en segundo plano con la fecha original, y se reintenta junto con las respuestas de los ejercicios (al abrir la cuenta y al recuperar la conexión). Solo se marca `synced` cuando el servidor devuelve el registro confirmado. Antes de enviar se comprueba que el token pertenezca a la misma cuenta (`sub` del JWT), porque el teléfono puede ser compartido. Un registro rechazado con 400 se marca con `syncError` y no bloquea los demás días. Al guardar un día nuevo se borran del teléfono los días anteriores ya enviados; los pendientes se conservan.

El día se cuenta en `America/Guatemala`, la zona con la que el backend crea las cuentas escolares. Las etiquetas del ánimo usan el género del perfil (Tranquila/Tranquilo) y una forma neutra si no lo hay.

El backend conserva el historial de registros diarios. La política de retención y el acceso pedagógico requieren una decisión explícita antes de añadir informes.

## Verificación

`StudentApiIntegrationTest` cubre la validación de horas y opciones, respuestas omitidas voluntariamente, idempotencia, aislamiento entre alumnos, envíos simultáneos y el cambio de día a medianoche en Guatemala. Se ejecuta contra un PostgreSQL desechable (Docker o las variables `TEST_DB_*` documentadas en la guía del backend); sin ellos se omite.

```sh
mvn -Dtest=StudentApiIntegrationTest test
```

`tests/daily-check-in.test.tsx` (vitest) cubre la primera respuesta del día, la limpieza de días enviados, el envío con la fecha original, el rechazo de tokens de otra cuenta, el formulario sin conexión y que no vuelva a preguntar si ya respondió en otro teléfono.
