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
