# API de directores

El frontend y el design system los desarrolla otro integrante del equipo. Este módulo implementa únicamente el backend.

## Registro por correo

1. El cliente registra correo y contraseña mediante Supabase Auth (`signUp`).
2. Supabase envía el enlace de confirmación. Debe estar habilitado **Confirm email**; desactivarlo confirma las cuentas automáticamente.
3. Después de confirmar el correo e iniciar sesión, el cliente envía `POST /api/directors/register` con su access token y `{ "name": "Nombre completo" }`.
4. El servidor comprueba `auth.users.email_confirmed_at`, crea el perfil idempotentemente y permite crear colegios.

No hay aprobación manual, como se acordó. Confirmar el correo permite crear un colegio nuevo, pero no acredita la representación de una institución existente ni concede acceso a colegios ajenos. El rol no se toma de `user_metadata` ni de un campo enviado por el cliente.

Configurar en el `.env` raíz las credenciales JDBC y `SUPABASE_AUTH_ISSUER=https://TU_PROJECT_REF.supabase.co/auth/v1`. El backend no necesita una publishable key ni una service-role key: consulta la confirmación del correo con su conexión JDBC. El equipo frontend debe configurar por separado su acceso público a Supabase Auth.

En Supabase, habilitar Email y Confirm email, configurar Site URL y las Redirect URLs que usará el cliente. Para enviar a direcciones fuera del equipo de Supabase se requiere SMTP personalizado; el proveedor predeterminado limita los destinatarios a miembros del equipo. [Documentación de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Permisos y alcance

- Un director puede crear varios colegios y administrar solo los suyos.
- Puede añadir y retirar profesores o alumnos mediante el correo de una cuenta ya confirmada en Supabase Auth.
- Añadir una cuenta al colegio no la asigna a todos los cursos: las asignaciones son explícitas.
- El rol de una asignación de curso se deriva de la membresía escolar. No permite convertir un alumno en profesor mediante el cuerpo de una petición.
- Quitar una persona elimina su membresía y asignaciones solo en ese colegio. Conserva su cuenta Auth, sus accesos a otros colegios y los temas que publicó.
- Eliminar un curso elimina sus temas y asignaciones. El cliente debe explicar este efecto antes de pedir confirmación.
- No hay eliminación de colegios ni de cuentas Auth, ni envío de invitaciones a terceros en esta iteración.

## Contrato HTTP

Todas las rutas requieren `Authorization: Bearer <access_token>`. Solo `GET /api/actuator/health` es público.

| Método | Ruta | Cuerpo / respuesta |
| --- | --- | --- |
| POST | `/api/directors/register` | `{ "name": "..." }`; devuelve perfil; requiere correo confirmado |
| GET | `/api/directors/me` | Perfil del director autenticado |
| POST | `/api/schools` | `{ "name": "..." }`; crea colegio y asigna propietario; `201` |
| GET | `/api/schools` | Colegios propios, incluido el rol DIRECTOR donde corresponda |
| GET | `/api/schools/{school}/members` | Profesores y alumnos del colegio propio |
| POST | `/api/schools/{school}/members` | `{ "email": "...", "role": "PROFESOR" }` o `ALUMNO`; `201` |
| DELETE | `/api/schools/{school}/members/{user}` | Retira acceso al colegio; `204` |
| GET | `/api/schools/{school}/courses` | Todos los cursos del colegio si es su director |
| POST | `/api/schools/{school}/courses` | `{ "name": "..." }`; `201` |
| DELETE | `/api/schools/{school}/courses/{course}` | Elimina curso, temas y asignaciones; `204` |
| GET | `/api/schools/{school}/courses/{course}/members` | Integrantes del curso |
| PUT | `/api/schools/{school}/courses/{course}/members/{user}` | Sin cuerpo; asigna una cuenta del mismo colegio; `204` |
| DELETE | `/api/schools/{school}/courses/{course}/members/{user}` | Retira del curso; `204` |
| GET | `/api/schools/{school}/statistics` | `{ "professors": 0, "students": 0, "courses": 0, "topics": 0 }` |

La estadística devuelve conteos actuales reales. Las métricas de aprendizaje quedan pendientes del módulo de ejercicios/progreso. El director puede consultar temas de sus cursos; publicarlos sigue reservado a profesores asignados.

Los campos desconocidos se rechazan. Un token inválido recibe `401`; un director sin correo confirmado, `403`; un colegio o curso ajeno, `404`; un conflicto de rol o datos, `409`. Los errores de dominio usan Problem Details con `status` y `detail`.

## Persistencia y aislamiento

V3 agrega `director_accounts` y `school_directors`, sin modificar migraciones anteriores. Hay un director por colegio y varios colegios por director. V4 revoca permisos directos de cliente y activa RLS en las tablas nuevas. Los roles PROFESOR y ALUMNO siguen en `school_memberships`; DIRECTOR se deriva de `school_directors`.

Las operaciones administrativas comprueban la confirmación del correo y bloquean la relación de propiedad durante la transacción. Cada curso y miembro se filtra por colegio. La conexión JDBC propietaria omite RLS, por lo que estas comprobaciones de la API siguen siendo obligatorias.

Los colegios anteriores a V3 no reciben director automáticamente. Un operador de confianza puede vincularlos explícitamente por SQL tras registrar su director. No existe una ruta pública para apropiarse de colegios existentes.

## Pruebas

`mvn test` verifica la API con JWT firmados, JWKS local y H2 temporal aplicando V1 y V3. Las migraciones PostgreSQL de RLS V2/V4 y consultas de aislamiento se han verificado por separado en PostgreSQL temporal. No se lee `.env`, no se modifica Supabase y no se envían correos en las pruebas. El envío real depende de la configuración de Supabase y SMTP.

Fuentes: [registro Supabase](https://supabase.com/docs/reference/javascript/auth-signup), [confirmación del correo](https://supabase.com/docs/guides/auth/general-configuration).
