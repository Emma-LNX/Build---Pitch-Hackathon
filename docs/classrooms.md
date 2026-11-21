# Aulas: contrato del backend

Implementación en Java 21 y Spring Boot, con Controller, Service, Repository (`JdbcTemplate`), DTOs, Bean Validation, transacciones y migraciones Flyway. No hay cambios de frontend.

## Qué representa un aula

Un aula es el grupo de una escuela: por ejemplo, **PRIMERO BÁSICO, sección A, ciclo 2026**. Tiene exactamente un profesor responsable y sus estudiantes. Puede empezar sin alumnos, pero nunca sin profesor.

Los cursos existentes representan materias o contenido y conservan sus asignaciones independientes. Crear un aula o matricular un estudiante en ella no concede acceso automático a cursos. No se ha añadido todavía una relación aula-curso.

## Datos

- `id`: UUID generado por el servidor.
- `schoolId`: escuela de la ruta; no se acepta en el cuerpo.
- `grade`: grado, obligatorio, hasta 80 caracteres.
- `section`: sección, obligatoria, hasta 16 caracteres.
- `academicYear`: ciclo escolar entre 1 y 9999, obligatorio e inmutable después de crear el aula.
- `teacherId`: UUID de una membresía PROFESOR de la misma escuela.
- `studentCount`: conteo de estudiantes matriculados, calculado por el servidor.
- `createdAt` y `updatedAt`: fechas con zona horaria. `updatedAt` refleja cambios de grado, sección o profesor.

Grado y sección se guardan en mayúsculas, quitando espacios iniciales/finales y agrupando los espacios internos. La combinación escuela + ciclo + grado + sección es única. El mismo grupo puede existir en otro ciclo o escuela.

Un alumno tiene como máximo un aula por escuela y ciclo. Puede tener matrícula en otro ciclo o escuela. El profesor puede ser responsable de varias aulas.

## Permisos

| Acción | Director | Profesor | Alumno |
| --- | --- | --- | --- |
| Listar y consultar aulas | Todas las de su escuela | Solo las que tiene asignadas | Solo aquellas donde está matriculado |
| Consultar lista de estudiantes | Sí, en su escuela | Solo de sus aulas | No |
| Crear, editar y eliminar aula | Solo en su escuela | No | No |
| Matricular, retirar y trasladar alumnos | Solo en su escuela | No | No |

El director debe conservar el correo confirmado. Las operaciones administrativas comparten el bloqueo de propiedad escolar con el resto de la API, dentro de la transacción. Cambiar el profesor retira inmediatamente el acceso del profesor anterior al aula.

## Rutas

Prefijo común: `/api/schools/{schoolId}/classrooms`. Todas requieren `Authorization: Bearer <access_token>`.

| Método | Ruta relativa | Acción |
| --- | --- | --- |
| GET | `/` | Listar aulas visibles; filtro opcional `?academicYear=2026` |
| POST | `/` | Crear aula; `201` |
| GET | `/{classroomId}` | Consultar detalle y conteo de alumnos |
| PUT | `/{classroomId}` | Actualizar grado, sección y profesor |
| DELETE | `/{classroomId}` | Eliminar solo si no tiene estudiantes; `204` |
| GET | `/{classroomId}/students` | Lista de estudiantes, con UUID, correo y fecha de matrícula |
| PUT | `/{classroomId}/students/{studentId}` | Matricular alumno del mismo colegio; sin cuerpo; idempotente; `204` |
| DELETE | `/{classroomId}/students/{studentId}` | Retirar matrícula del aula; `204` |
| POST | `/{classroomId}/students/{studentId}/transfer` | Traslado transaccional a otra aula del mismo colegio y ciclo; `204` |

Crear aula:

```json
{
  "grade": "Primero básico",
  "section": "A",
  "academicYear": 2026,
  "teacherId": "UUID_DEL_PROFESOR"
}
```

Editar aula usa `grade`, `section` y `teacherId`. No admite `academicYear`: para el nuevo ciclo se crea otra aula, conservando la anterior.

Trasladar un alumno:

```json
{
  "targetClassroomId": "UUID_DEL_AULA_DESTINO"
}
```

Si el traslado falla, se mantiene la matrícula original. El cambio conserva la fecha de matrícula del ciclo. Para pasar al ciclo siguiente se crea una matrícula nueva; no se usa el traslado.

## Reglas de eliminación y consistencia

- Retirar a un alumno del aula conserva su cuenta, su membresía escolar y sus asignaciones a cursos.
- Retirarlo de la escuela elimina también sus matrículas de aula de esa escuela. No afecta otras escuelas ni borra su cuenta Auth.
- Un aula con alumnos no se elimina: primero hay que retirarlos o trasladarlos; devuelve `409` mientras esté ocupada.
- No se puede retirar del colegio a un profesor que todavía es responsable de aulas. Hay que reasignarlas o eliminar las vacías antes; devuelve `409` con una explicación.
- No se modifica la información ni los temas de los cursos al crear, editar o eliminar un aula.

El endpoint existente de estadísticas del director agrega el campo `classrooms`, con el número de aulas de la escuela, contando todos los ciclos.

El profesor asignado consulta el [progreso y las estadísticas del aula](teachers.md) y puede marcar temas difíciles para sus alumnos matriculados.

## Cuentas de alumnos con usuario y contraseña

Muchos alumnos no tienen correo. El director de la escuela (con correo confirmado) o el profesor responsable del aula les crea una cuenta; el alumno entra en la PWA (`/entrar`) solo con usuario y contraseña.

| Método | Ruta relativa | Acción |
| --- | --- | --- |
| POST | `/{classroomId}/student-accounts` | Crea la cuenta, la membresía ALUMNO, la matrícula en el aula y el perfil `alumnos`; `201` |
| PUT | `/{classroomId}/student-accounts/{studentId}/password` | Cambia la contraseña de una cuenta creada por la escuela y matriculada en esa aula; `204` |

```json
{ "username": "ana.lopez", "password": "secreto1", "alias": "Ana" }
```

Respuesta `201`: `{ "studentId": "UUID", "username": "ana.lopez", "alias": "Ana", "classroomId": "UUID" }`. `studentId` es el id del usuario en Supabase Auth (el `sub` de su JWT), el mismo que usan las rutas de matrícula.

- `username`: 3 a 30 caracteres `[a-z0-9._]`, sin punto al inicio, al final ni dos seguidos; se guarda en minúsculas. En Supabase se registra como `usuario@alumnos.mayamente.app`, con correo confirmado, `user_metadata = {username, alias}` y `app_metadata = {kind: "student"}`. No hay tabla nueva: el usuario es la parte antes de `@`.
- `password`: 6 a 72 caracteres. `alias`: 1 a 40 caracteres.
- El perfil toma `grado_escolar` del grado del aula (máximo 30 caracteres) y la zona `America/Guatemala`.
- Flujo: se validan permisos y aula, se crea el usuario con la Admin API de Supabase y luego, en una sola transacción, membresía + matrícula + perfil. Si la base de datos falla, se borra el usuario de Supabase y se devuelve el error.
- El cambio de contraseña solo aplica a cuentas `@alumnos.mayamente.app`; nunca a alumnos que entran con su propio correo.
- Requiere `SUPABASE_SERVICE_ROLE_KEY` en el backend (ver `backend/README.md`); sin ella responde `503`.

Errores propios: `400` datos inválidos o contraseña débil; `404` profesor de otra aula, alumno, director de otra escuela o aula ajena; `403` director sin correo confirmado; `409` "Ese usuario ya existe"; `502`/`503` Supabase no disponible o sin configurar.

Ejemplo en PowerShell (token de un director o del profesor del aula):

```powershell
$headers = @{ Authorization = 'Bearer <TOKEN_DIRECTOR_O_PROFESOR>' }
$body = @{ username = 'ana.lopez'; password = 'secreto1'; alias = 'Ana' } | ConvertTo-Json
Invoke-RestMethod 'http://localhost:8081/api/schools/<SCHOOL_ID>/classrooms/<CLASSROOM_ID>/student-accounts' `
  -Method Post -Headers $headers -ContentType 'application/json' -Body $body
```

## Persistencia y errores

V8 agrega `classrooms` y `classroom_students`. Las claves compuestas impiden profesores/alumnos de otra escuela, roles incorrectos y ciclos que no coincidan con el aula. La restricción única de matrícula protege también frente a inserciones concurrentes. V9 revoca acceso directo de clientes y activa RLS sin políticas públicas en ambas tablas.

Se mantienen las migraciones anteriores sin cambios. Las aulas no requieren variables nuevas en `.env`; las cuentas de alumnos sí necesitan `SUPABASE_SERVICE_ROLE_KEY`. Flyway aplicará V8/V9 al arrancar el backend contra Supabase; no se han aplicado al proyecto remoto durante el desarrollo.

- `400`: datos inválidos o campos desconocidos.
- `401`: token ausente o inválido.
- `403`: alumno intentando consultar la lista de compañeros, o director sin correo confirmado.
- `404`: escuela/aula/usuario ajeno, inexistente o con rol incorrecto para la asignación.
- `409`: grupo duplicado, alumno ya matriculado en otra aula del mismo ciclo, traslado a otro ciclo o eliminación bloqueada.

## Verificación

`mvn test` ejecuta las pruebas de RBAC y aulas con JWT firmados y H2 temporal; no lee `.env` ni usa Supabase. Las migraciones V1–V12, las consultas de aulas, las restricciones, cascadas y RLS también se comprobaron en PostgreSQL temporal.
