# Roles y separación por colegio

Hay tres roles: DIRECTOR, PROFESOR y ALUMNO. Todos los permisos se limitan al colegio correspondiente.

| Acción | Director | Profesor | Alumno |
| --- | --- | --- | --- |
| Crear colegio | Tras confirmar correo y activar perfil | No, salvo registrar aparte su propio perfil de director | No, salvo registrar aparte su propio perfil de director |
| Consultar cursos y temas | Todos los de su colegio | Solo cursos asignados | Solo cursos donde está inscrito |
| Crear temas | No | Solo en cursos asignados | No |
| Añadir o retirar miembros | Solo en su colegio | No | No |
| Crear y eliminar cursos | Solo en su colegio | No | No |
| Asignar integrantes a cursos | Solo en su colegio | No | No |
| Consultar estadísticas administrativas | Solo en su colegio | No | No |

La cuenta de director no es un permiso global. Crear un perfil nuevo no concede acceso a colegios existentes. El modelo permite ser profesor o alumno en un colegio y director de otro. La membresía escolar por sí sola no da acceso a todos los cursos.

## Autenticación

Supabase Auth registra y confirma el correo; Spring valida los access tokens contra el JWKS del proyecto. Configurar `SUPABASE_AUTH_ISSUER=https://TU_PROJECT_REF.supabase.co/auth/v1` sin barra final. Se requiere firma asimétrica RS256 o ES256, emisor correcto, audiencia `authenticated`, expiración y `sub` UUID.

El claim estándar `role: authenticated` y `user_metadata` no conceden permisos académicos. Estos se consultan en la base de datos en cada petición. El director, además, debe conservar un correo confirmado en `auth.users` para realizar operaciones administrativas.

Ver [contrato de API del director](directors.md) para completar la configuración.

## Modelo

- `schools`: colegios.
- `director_accounts`: perfiles de director activados tras verificar el correo.
- `school_directors`: propiedad de cada colegio por su director.
- `school_memberships`: usuario de Supabase Auth + colegio + rol PROFESOR o ALUMNO.
- `courses`: cursos de cada colegio.
- `course_memberships`: profesores asignados y alumnos inscritos.
- `topics`: contenido del curso y autor autenticado.

Las claves compuestas impiden mezclar colegios o cambiar el rol de un alumno mediante una asignación de curso. Quitar la membresía retira las asignaciones del colegio, pero conserva la cuenta y el contenido publicado. Las asignaciones se administran mediante la API del director.

## API de consulta y temas

Todas requieren `Authorization: Bearer <access_token>`.

| Método | Ruta | Acción |
| --- | --- | --- |
| GET | `/api/schools` | Colegios propios con el rol del usuario |
| GET | `/api/schools/{schoolId}/courses` | Cursos permitidos |
| GET | `/api/schools/{schoolId}/courses/{courseId}/topics` | Temas permitidos |
| POST | `/api/schools/{schoolId}/courses/{courseId}/topics` | Crear tema como profesor asignado |

Crear un tema acepta solo `title` (hasta 160 caracteres) y `content` (hasta 20000). No se puede enviar otro usuario, colegio o rol en el cuerpo. El autor sale del token verificado. El `INSERT` comprueba también la asignación de profesor.

Un token ausente o inválido recibe `401`; una operación conocida pero prohibida, `403`; un colegio/curso ajeno, `404`. Las rutas nuevas que todavía no se implementan permanecen bloqueadas por defecto.

## PostgreSQL y offline

`math_portal` es privado al backend. No exponerlo en la Data API de Supabase. RLS no tiene políticas de cliente y se revocan permisos a `PUBLIC`, `anon` y `authenticated`. La conexión JDBC de propietario omite RLS: todas las consultas de la API deben seguir comprobando el usuario, colegio y curso.

Los permisos remotos se deben comprobar de nuevo al sincronizar la futura cola offline. La caché deberá separarse por usuario, colegio y curso y limpiarse al cerrar sesión o cambiar de cuenta. El contenido ya descargado no se puede retirar de un teléfono que siga desconectado.

## Pruebas

`mvn test` ejecuta pruebas HTTP con Spring Security real, JWT firmados, JWKS local y H2 temporal. Aplica V1 y V3 para probar roles, confirmación, propiedad, cruces de colegio, retirada de accesos, campos inyectados y tokens inválidos. Las migraciones PostgreSQL de RLS se verifican separadamente. No se usan credenciales de Supabase.

Fuentes: [JWT de Supabase](https://supabase.com/docs/guides/auth/jwts), [claves de firma](https://supabase.com/docs/guides/auth/signing-keys), [Spring Security](https://docs.spring.io/spring-security/reference/6.5/servlet/oauth2/resource-server/jwt.html).
