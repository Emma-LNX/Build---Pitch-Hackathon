# Registro diario antes de las lecciones

Antes de la primera lección del día se muestran tres preguntas: horas de sueño de la noche anterior, alimentación de hoy y estado de ánimo actual. Completar el formulario permite entrar en cualquier lección durante ese día. Volver al mapa sin responder no comienza la lección. No se interrumpe una lección en curso al cambiar de día.

Cada pregunta admite “Prefiero no responder”. Las respuestas no generan XP, no suman racha y no modifican la dificultad. No se interpretan como diagnósticos ni se muestran en el ranking o en las estadísticas de profesores/directores.

## Backend

La migración `V15__daily_check_ins.sql` crea `math_portal.registros_diarios`, con una fila por alumno y fecha. RLS y la revocación de permisos de cliente siguen el modelo del proyecto. No modificar las migraciones V1–V14 ya existentes.

Las rutas requieren un JWT válido y un perfil de alumno activo. La identidad siempre se resuelve desde el token; no se acepta `studentId`. El registro del día usa fecha del servidor; la ruta de sincronización admite explícitamente fechas autodeclaradas para conservar las respuestas offline.

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

## Vinculación e interfaz

El frontend inicia sesión con usuario escolar o correo y contraseña mediante una única instancia del cliente oficial de Supabase. Los usuarios escolares se traducen al dominio `alumnos.mayamente.app`, igual que en el backend. La sesión persistida y su renovación las administra el SDK. Cada petición privada incluye el access token; Spring valida su firma, emisor, audiencia y vigencia. El registro de cuentas y confirmación del correo se siguen realizando en Supabase Auth; el personal autorizado puede crear cuentas escolares desde la API administrativa.

Al guardar el perfil se consulta `GET /api/students/me`; si no existe, se crea por `POST` con el token de la cuenta. Se guarda el UUID remoto del alumno, su zona horaria y el identificador de la cuenta. El servidor nunca confía en un propietario enviado por el cliente. Los perfiles existentes pueden actualizar su alias y grado mediante PATCH.

`DailyCheckInGate` consulta el GET autenticado como fuente de verdad al entrar a cada lección. Guarda las respuestas y las envía a la API; solo marca `synced` después de recibir el registro confirmado. Sin conexión permite continuar tras guardar localmente. La cola se reintenta al iniciar, recuperar conexión, recuperar foco y abrir una lección. Hay un aviso de registros pendientes y un botón para reintentar. Los errores de sesión y permisos se muestran, no se confunden con funcionamiento offline.

IndexedDB usa una base separada por cuenta (`math-portal:<authUserId>`). Su versión 3 agrega `answers` y `mastery` para el aprendizaje adaptativo sin borrar los registros diarios de la versión 2. Tanto las respuestas adaptativas como las de bienestar se sincronizan desde la base de su propietario. La cola verifica que la sesión siga perteneciendo a esa cuenta antes de cada petición. Cerrar sesión o cambiar de usuario desmonta el estado anterior; no mezcla perfiles ni respuestas. Los registros pendientes se conservan al cambiar de día; los antiguos ya sincronizados pueden limpiarse del dispositivo. El día offline usa la zona del perfil remoto. Una instalación nueva requiere conexión para iniciar sesión y vincular el perfil; una sesión previamente guardada permite usar los datos disponibles sin conexión.

La lección, el diagnóstico y la misión adaptativa consultan el mismo registro diario. La migración V15 de bienestar conserva su versión y checksum; V16 agrega las respuestas adaptativas, sin colisión de versiones.

El perfil anterior sin autenticación se conserva en la base local original. La pantalla de perfil ofrece vincularlo solo con consentimiento explícito, copiando progreso y respuestas pendientes. Esa base queda asociada a una única cuenta para impedir que otra la importe. No se borran datos locales sin confirmar ni se asigna automáticamente el perfil al primer usuario que inicia sesión.

El backend conserva el historial de registros diarios. La política de retención y el acceso pedagógico requieren una decisión explícita antes de añadir informes. El bloqueo ocurre al entrar a la lección; no se rechazan partidas históricas al sincronizarlas por no tener registro diario. Este cambio conecta el registro diario; la adaptación del protocolo de sincronización de partidas generadas por el frontend sigue siendo independiente.

## Configuración

Configurar `SUPABASE_URL` (o `SUPABASE_AUTH_ISSUER`) y `SUPABASE_PUBLISHABLE_KEY` en el proceso del backend. Compose transmite estas variables desde `.env`. `GET /api/auth/config` es público y devuelve únicamente la URL y la clave pública; rechaza claves secretas y JWT `service_role`. Admite publishable keys nuevas y anon keys antiguas. Nunca se entregan las credenciales JDBC al navegador. El cliente guarda esta configuración pública para poder recuperar su sesión offline.

No hay que copiar secretos al código ni definir una service-role key en Vite. Referencias: [sesiones de Supabase](https://supabase.com/docs/reference/javascript/auth-getsession) y [eventos de autenticación](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

## Verificación

`StudentApiIntegrationTest` cubre la validación de horas y opciones, respuestas omitidas voluntariamente, idempotencia, aislamiento entre alumnos, envíos simultáneos y el cambio de día a medianoche en Guatemala. Se ejecuta contra un PostgreSQL desechable según las variables `TEST_DB_*` documentadas en la guía del backend.

```sh
mvn -Dtest=StudentApiIntegrationTest,AuthConfigControllerTest test
```

`pnpm build` compila el frontend. Con el servidor Vite iniciado, `pnpm test:e2e` prueba el login, la vinculación, el JWT en peticiones, persistencia remota, recarga, separación entre cuentas, conservación de fechas offline y rechazo de sesión vencida. Usa Chrome instalado (o Chromium en CI, tras `pnpm exec playwright install chromium`). `APP_URL` permite cambiar el servidor de pruebas. Auth y API se simulan en la prueba del navegador para no crear datos personales de prueba en Supabase; las pruebas del backend usan PostgreSQL real desechable.
