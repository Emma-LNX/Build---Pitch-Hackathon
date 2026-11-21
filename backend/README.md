# Backend de alumnos

API de acompañamiento educativo con Java 21, Spring Boot, JPA y PostgreSQL. Implementa perfiles de alumnos, consulta de contenido versionado, partidas, XP, niveles, progreso, rachas y ranking. Las reglas de negocio están en [el contexto de alumnos](../docs/contexto-alumnos.md).

## Configuración y ejecución

Configurar estas variables en el proceso de Java (Maven no lee `.env` automáticamente):

```dotenv
SUPABASE_DB_URL=jdbc:postgresql://HOST:5432/postgres?sslmode=require
SUPABASE_DB_USERNAME=USUARIO
SUPABASE_DB_PASSWORD=CONTRASENA
SUPABASE_URL=https://TU_PROYECTO.supabase.co
```

`SUPABASE_URL` es la URL base del proyecto, sin `/` al final. Para Docker Compose se toman del `.env` de la raíz. Usar la conexión directa o Session pooler de PostgreSQL, porque los bloqueos y transacciones requieren una conexión de sesión apropiada.

```sh
cd backend
mvn verify
mvn spring-boot:run
```

El servidor escucha en `http://localhost:8081/api`. `GET /api/actuator/health` es público; las demás rutas requieren `Authorization: Bearer <access_token>`. Flyway aplica las migraciones al iniciar la aplicación; JPA valida el esquema. No hace falta crear tablas a mano.

Las migraciones crean las nueve tablas del dominio, los tres niveles iniciales y una actividad de sumas de opción múltiple con recompensa de 50 XP. Las versiones publicadas tienen un trigger que impide editarlas o eliminarlas; una corrección del contenido debe crear una versión nueva.

## Autenticación

El frontend inicia sesión o registra al usuario mediante Supabase Auth y envía su `access_token` a Java. Esta API no almacena contraseñas ni implementa otro inicio de sesión. El perfil de alumno se crea después de autenticarse con `POST /students/me`.

Se usa Spring Security Resource Server para validar firma JWT, expiración, emisor y audiencia `authenticated`; se admiten claves asimétricas ES256 y RS256 del JWKS de Supabase. El proyecto Supabase debe tener una clave de firma asimétrica activa. Los tokens legacy HS256 requieren migrar la configuración de firma de Auth; no se aceptan como alternativa silenciosa. Referencias: [Spring Security JWT](https://docs.spring.io/spring-security/reference/6.5/servlet/oauth2/resource-server/jwt.html) y [Supabase JWT](https://supabase.com/docs/guides/auth/jwts).

La identidad proviene del `sub` del token validado, nunca de un campo `studentId` ni de una cabecera inventada por el cliente. Las operaciones privadas resuelven exclusivamente al alumno autenticado. El ranking expone alias, nivel, XP y posición; nunca expone el identificador de autenticación.

## Contratos HTTP

Las rutas de esta tabla se agregan al prefijo `/api`. Las respuestas usan nombres de campos en inglés; las tablas conservan los nombres en español definidos en el contexto.

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | `/students/me` | Crea el perfil; 201. Una identidad duplicada produce 409. |
| GET | `/students/me` | Consulta el perfil propio. |
| PATCH | `/students/me` | Edita preferencias del perfil propio. |
| GET | `/students/me/progress` | XP, nivel actual, siguiente nivel, rachas y avance por tema. |
| GET | `/students/me/activities/{activityId}/progress` | Estado, intentos y mejor puntuación. |
| GET | `/students/me/attempts?page=0&size=20` | Historial propio paginado. |
| POST | `/attempts` | Evalúa y registra una partida; 200 tanto al crear como al reenviar. |
| GET | `/levels` | Catálogo de niveles. |
| GET | `/ranking?page=0&size=20` | Ranking global voluntario paginado. |
| GET | `/topics` | Temas activos. |
| GET | `/topics/{topicId}/activities` | Actividades activas del tema. |
| GET | `/activities/{activityId}/versions/latest` | Última versión publicada con contenido para jugar. |
| GET | `/activity-versions/{versionId}` | Versión específica disponible para jugar o descargar. |

Errores: 400 para entradas inválidas, 401 para autenticación inválida o ausente, 403 para perfil inactivo, 404 para perfil o contenido no disponible, 409 para conflictos de identidad o idempotencia, 422 para una versión que no puede evaluarse. Los errores de aplicación usan Problem Details; los fallos de autenticación los responde Spring Security. Los errores de validación de campos incluyen un objeto `errors`.

Las páginas tienen `content`, `page`, `size`, `totalElements` y `totalPages`. `page` empieza en 0 y `size` acepta de 1 a 100. Los empates de ranking comparten posición, calculada antes de paginar (1, 1, 3).

### Crear y editar perfil

```json
{
  "alias": "Emily",
  "avatarKey": "zorro_azul",
  "schoolGrade": "Quinto",
  "timeZone": "America/Guatemala",
  "rankingEnabled": false
}
```

Solo `alias` es obligatorio al crear. La zona predeterminada es `America/Guatemala` y la participación en ranking empieza desactivada. `avatarKey` acepta letras ASCII, números, `_` y `-`; representa una clave, no una URL ni un archivo subido.

En PATCH, los campos omitidos o `null` quedan sin cambios. Para borrar `avatarKey` o `schoolGrade`, enviar `""`. No se pueden editar puntos, estado, propietario, nivel ni racha; los campos desconocidos producen 400.

### Enviar partida

Ejemplo contra la versión inicial de sumas:

```json
{
  "id": "40000000-0000-0000-0000-000000000001",
  "activityVersionId": "30000000-0000-0000-0000-000000000001",
  "answers": {"q1": "b", "q2": "a"},
  "origin": "ONLINE",
  "clientFinishedAt": "2026-11-21T18:00:00Z"
}
```

`id`, `activityVersionId`, `answers` y `origin` son obligatorios. `origin` acepta `ONLINE` u `OFFLINE`; `clientFinishedAt` es opcional y se conserva con precisión de microsegundos. Las respuestas relacionan identificadores de pregunta con identificadores de opción. Se requiere al menos una respuesta y se permiten como máximo 100; las preguntas omitidas cuentan como incorrectas. Las preguntas u opciones desconocidas producen 400 sin registrar la partida.

El juego implementado en el MVP es `OPCION_MULTIPLE`: cada pregunta tiene el mismo peso y se aprueba según el umbral de la versión. La API devuelve el contenido público y mantiene las respuestas correctas en `reglas_evaluacion`, sin exponerlas en el DTO.

La respuesta contiene `attempt` (resultado persistido y XP que esa partida otorgó) y `progress` (resumen actual del alumno). El backend calcula la evaluación y el calendario con su propio reloj.

- Reutilizar el mismo UUID y contenido devuelve el resultado guardado. El resumen `progress` refleja el estado actual, que puede haber cambiado desde el primer envío.
- Reutilizar el UUID con distinto contenido o propietario devuelve 409.
- Una nueva partida de una actividad ya aprobada registra práctica y puede sumar un día de racha, pero otorga 0 XP.
- La primera aprobación con recompensa cero también completa la actividad y consume su oportunidad de recompensa; otra versión no otorga XP retroactivamente.
- La racha offline se acredita en la fecha local de recepción; no se acredita la fecha declarada por el dispositivo. Cambiar la zona horaria no modifica días anteriores.
- La partida, el progreso, los puntos y el día de aprendizaje se confirman o revierten juntos. Bloqueos transaccionales en PostgreSQL serializan los reintentos por UUID y las escrituras de cada alumno.
- Un reintento idéntico de una partida ya aceptada sigue devolviendo su resultado aunque la actividad se desactive después. Las partidas nuevas requieren contenido activo.

La creación o administración de juegos queda fuera de estos controladores. El catálogo inicial se carga mediante migraciones; para ampliarlo, agregar una nueva migración con una versión publicada e inmutable.

## Pruebas

`mvn verify` ejecuta las pruebas unitarias. La suite `StudentApiIntegrationTest` prueba migraciones reales, validación JPA, controladores, JWT firmados, separación de cuentas, ranking, niveles, idempotencia, concurrencia y reversión transaccional sobre PostgreSQL. Arranca automáticamente PostgreSQL 17 mediante Testcontainers si Docker está disponible. Sin Docker ni base de pruebas, esa suite aparece como omitida.

También se puede usar un PostgreSQL desechable propio mediante `TEST_DB_URL`, `TEST_DB_USERNAME` y `TEST_DB_PASSWORD`. Ejemplo en PowerShell:

```powershell
$env:TEST_DB_URL = 'jdbc:postgresql://127.0.0.1:55432/math_portal_test'
$env:TEST_DB_USERNAME = 'postgres'
$env:TEST_DB_PASSWORD = 'postgres'
mvn verify
```

La suite aplica migraciones, vacía `math_portal.alumnos` y sus tablas dependientes antes de cada prueba y agrega contenido de prueba. **Usar exclusivamente una base desechable**: nunca indicar la base compartida de Supabase. Las pruebas no leen `.env` y sustituyen las credenciales y el emisor JWT de la aplicación por configuración local de prueba.

Validación realizada: `mvn verify` con PostgreSQL 17.5 temporal; 24 pruebas aprobadas, ninguna omitida. Se generó el JAR del backend. No se ejecutaron migraciones sobre la base compartida de Supabase.


## Estadisticas del backend

El modulo usa Java 21, el DataSource existente y el esquema `math_portal`. El controlador declara
`/estadisticas`; `application.yml` aporta `/api` una sola vez. Todas estas rutas requieren
`Authorization: Bearer <access_token de Supabase>`.

| Metodo | Ruta completa | Resultado |
| --- | --- | --- |
| GET | `/api/estadisticas/me` | Nivel y avance de XP, racha de practica, totales, aciertos por tema y promedios por desafio. |
| GET | `/api/estadisticas/me/desafios` | Cada partida terminada, porcentaje de aciertos, aprobacion y tiempos individuales. |
| GET | `/api/estadisticas/me/historial/niveles` | Evolucion de XP y nivel en cada recompensa. |
| GET | `/api/estadisticas/me/historial/errores` | Errores y preguntas omitidas por partida y version, sin revelar la respuesta correcta. |
| PUT | `/api/estadisticas/me/partidas/{partidaId}/tiempo` | Registra tiempos de una partida propia ya enviada a `/api/attempts`. |
| GET | `/api/estadisticas/profesor/alumnos` | Lista paginada de alumnos activos de cursos asignados al profesor. |
| GET | `/api/estadisticas/profesor/alumnos/{alumnoId}` | Resumen del alumno asignado. |
| GET | `/api/estadisticas/profesor/alumnos/{alumnoId}/desafios` | Partidas y tiempos individuales del alumno. |
| GET | `/api/estadisticas/profesor/alumnos/{alumnoId}/historial/niveles` | Historial de XP y niveles del alumno. |
| GET | `/api/estadisticas/profesor/alumnos/{alumnoId}/historial/errores` | Historial de errores del alumno. |

Las listas aceptan `?page=0&size=20` (size de 1 a 100). Los campos de detalle del modulo
usan nombres en espanol; las filas SQL usan `snake_case` y los contenedores/DTO usan `camelCase`.
`alumnoId` es el ID del perfil de `alumnos`, que puede diferir del subject de Auth. Se obtiene
de la lista del profesor; el ID del propietario nunca se acepta en el cuerpo de una escritura.
Se verifica en BD que profesor y alumno tengan los roles respectivos en el mismo colegio y curso.
Compartir solo colegio no basta. Sin membresia de profesor: 403. Alumno ajeno, inactivo o
partida ajena: 404. La revocacion de membresias tiene efecto en la siguiente consulta.

Una partida terminada es cualquier intento aceptado, aprobado o fallido. Un desafio completado
es una actividad distinta con al menos una aprobacion. Los aciertos por tema se ponderan por
cantidad de preguntas de todos los intentos; las omitidas cuentan como errores.
La racha de practica incluye intentos fallidos y usa la fecha de aprendizaje registrada por el
servidor y la zona horaria del alumno. Puede diferir de la racha de aprendizaje previa, que solo
considera dias con aprobaciones.

### Probar las rutas en PowerShell

Arrancar el backend con las variables de conexion ya configuradas en el proceso:
`mvn spring-boot:run`. Flyway aplicara V7 al iniciar. Este trabajo no ejecuto migraciones en
la base compartida de Supabase ni leyo archivos `.env`.

```powershell
$base = 'http://localhost:8081/api/estadisticas'
$alumnoHeaders = @{ Authorization = 'Bearer <TOKEN_ALUMNO>' }
$profesorHeaders = @{ Authorization = 'Bearer <TOKEN_PROFESOR>' }

Invoke-RestMethod "$base/me" -Headers $alumnoHeaders
Invoke-RestMethod "$base/me/desafios?page=0&size=20" -Headers $alumnoHeaders
Invoke-RestMethod "$base/me/historial/niveles" -Headers $alumnoHeaders
Invoke-RestMethod "$base/me/historial/errores" -Headers $alumnoHeaders
Invoke-RestMethod "$base/profesor/alumnos" -Headers $profesorHeaders
Invoke-RestMethod "$base/profesor/alumnos/<ALUMNO_ID>" -Headers $profesorHeaders
```

Para registrar tiempo, enviar primero la partida mediante `POST /api/attempts`, conservar su UUID
y luego enviar este cuerpo al PUT de tiempo con el token del mismo alumno:

```json
{
  "iniciadaEn": "2026-11-21T17:00:00Z",
  "finalizadaEn": "2026-11-21T17:02:00Z",
  "tiempoActivoMs": 75000
}
```

```powershell
$tiempo = @{
  iniciadaEn = '2026-11-21T17:00:00Z'
  finalizadaEn = '2026-11-21T17:02:00Z'
  tiempoActivoMs = 75000
} | ConvertTo-Json

Invoke-RestMethod "$base/me/partidas/<PARTIDA_ID>/tiempo" -Method Put `
  -Headers $alumnoHeaders -ContentType 'application/json' -Body $tiempo
```

Adaptar las fechas al intento real: inicio <= fin <= recepcion de la partida y reloj del servidor.
El ejemplo representa 120000 ms transcurridos y 75000 ms activos. Todas las duraciones usan
milisegundos y las fechas se normalizan a esa precision.

El cliente mide solo los intervalos de interaccion con la pantalla visible y sin pausa para
`tiempoActivoMs`; `finalizadaEn - iniciadaEn` incluye pausas. Son mediciones declaradas por
el cliente (`fuente: CLIENTE`), sujetas a validacion de consistencia, no una medicion verificada
de atencion. Este cambio no modifica el frontend: el consumidor debe enviar estos tiempos.
El tiempo activo debe estar entre cero y el transcurrido. Un intervalo invalido devuelve 400.
Repetir datos identicos devuelve 200; intentar reemplazarlos devuelve 409.
Las partidas anteriores y las nuevas sin telemetria muestran tiempos `null`.
Los promedios y las sumas solo consideran partidas con medicion; `partidas_con_tiempo` permite
conocer la cobertura. Sin mediciones, tiempos y promedios permanecen `null`, nunca cero inventado.

### Persistencia y pruebas de estadisticas

V7 agrega `estadistica_respuestas`, `estadistica_niveles` y `estadistica_tiempos`.
Los triggers de partidas y movimientos de XP capturan historial dentro de la misma transaccion
del flujo existente. No hay rutas que permitan reescribir resultados o historial.
Los reintentos originales no disparan inserciones adicionales. Las tablas nuevas tienen RLS
sin politicas de cliente y permisos revocados para PUBLIC y roles Supabase anon/authenticated.

La migracion reconstruye preguntas y errores desde las respuestas y versiones inmutables existentes.
Reconstruye el nivel de cada recompensa historica con XP acumulado y los umbrales actuales:
esas filas tienen `reconstruido: true`. Las nuevas capturas conservan numero y nombre del nivel en
ese momento y tienen `reconstruido: false`. El historial empieza con la primera recompensa;
un alumno sin recompensas tiene historial vacio y nivel inicial en el resumen. No se puede
recuperar cambios antiguos de umbrales no registrados ni tiempos que nunca se midieron.

`mvn verify` incluye pruebas de autorizacion con H2 y de validacion de tiempos.
`EstadisticasPostgresIntegrationTest` verifica V7, preguntas omitidas, porcentajes, promedios,
historial, aislamiento entre alumnos/profesores, idempotencia y rollback en PostgreSQL real.
Usa Docker automaticamente o las variables `TEST_DB_*` documentadas arriba.
Las suites PostgreSQL vacian alumnos, colegios y dependencias: usar solo una base desechable.

Verificacion de este modulo: `mvn verify` con PostgreSQL 17.5 temporal; 57 pruebas aprobadas,
ninguna fallida ni omitida, incluida la reconstruccion de historial anterior a V7. JAR generado.
El equipo tiene JDK 26.0.1; Maven compilo con `--release 21` y se verifico bytecode de Java 21
(major version 65). La instancia temporal se detuvo al finalizar.