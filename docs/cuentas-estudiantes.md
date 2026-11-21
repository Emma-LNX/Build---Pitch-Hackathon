# Cuentas de estudiantes y acceso

Los estudiantes no se registran solos. Su profesor crea la cuenta con nombre, usuario, contraseña inicial y clase. El estudiante entra con usuario y contraseña, y la app abre directamente su clase.

## Cómo funciona

```text
Panel docente ──POST /api/teacher/classes/{curso}/students──► Backend ──Admin API──► Supabase Auth
                                                                │                    (guarda la contraseña con hash)
                                                                └─► math_portal.student_accounts, course_memberships, alumnos

Estudiante ──POST /api/auth/student/login {usuario, contraseña}──► Backend ──► Supabase Auth (valida)
           ◄── access token + refresh token ──
           ──GET /api/students/me/class──► su clase (desde la cuenta creada por el profesor)
```

- **Contraseñas.** Solo las guarda Supabase Auth, con hash. Las tablas de la API, los JSON, `localStorage` e IndexedDB nunca las contienen. Las pruebas automatizadas lo comprueban.
- **Usuario.** Cada estudiante recibe en Supabase Auth un correo interno `usuario@STUDENT_EMAIL_DOMAIN`, ya confirmado, al que nunca se envían mensajes. El niño solo ve su usuario. El usuario es único sin distinguir mayúsculas.
- **Entrega de credenciales.** El panel docente muestra la contraseña **una sola vez**, con las opciones Copiar e Imprimir. Después no se puede consultar. Si se olvida, el profesor crea una nueva.
- **Permisos (en el servidor).** El profesor solo administra los cursos donde figura como `PROFESOR` en `course_memberships`. Los cursos ajenos responden 404. El estudiante solo accede a sus datos: la identidad sale del token, nunca del cuerpo de la petición.
- **Intentos fallidos.** Tras 5 fallos seguidos con el mismo usuario, se bloquea 5 minutos (429), además de los límites propios de Supabase Auth. El mensaje es el mismo para un usuario inexistente o una contraseña incorrecta.
- **Género.** Se guarda en `alumnos.genero` (`NINA`/`NINO`) con `PATCH /api/students/me`. No interviene en el acceso ni en la clase; solo filtra el guardarropa.

## Rutas nuevas

| Método | Ruta | Quién | Acción |
| --- | --- | --- | --- |
| POST | `/api/auth/student/login` | Público | Usuario + contraseña → tokens |
| POST | `/api/auth/staff/login` | Público | Correo + contraseña del profesor → tokens |
| POST | `/api/auth/refresh` | Público | Renueva tokens con el refresh token |
| POST | `/api/auth/logout` | Autenticado | Cierra la sesión en Supabase Auth |
| GET | `/api/students/me/class` | Estudiante | Su clase, nombre, usuario y género |
| GET | `/api/teacher/classes` | Profesor | Sus clases |
| GET | `/api/teacher/classes/{curso}/students` | Profesor de ese curso | Cuentas de la clase (sin contraseñas) |
| POST | `/api/teacher/classes/{curso}/students` | Profesor de ese curso | Crear cuenta (`displayName`, `username`, `password`) |
| PUT | `/api/teacher/students/{id}/password` | Profesor de su curso | Restablecer contraseña |
| PUT | `/api/teacher/students/{id}/class` | Profesor de ambos cursos | Cambiarlo a otra clase del mismo colegio |

Migraciones: `V15__student_accounts.sql` (tabla y columna `genero`) y `V16__protect_student_accounts.sql` (RLS y permisos, como V4/V6). V13–V14 pertenecen al módulo de contactos y reportes de padres integrado desde `main`.

## Configuración

Variables del **backend**. Ninguna va en el frontend:

```dotenv
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=...            # pública: inicio de sesión y renovación
SUPABASE_SERVICE_ROLE_KEY=...    # SECRETA: crear usuarios y cambiar contraseñas
STUDENT_EMAIL_DOMAIN=alumnos.mayamente.invalid
```

Sin estas variables, las rutas de cuentas responden 503 con un mensaje claro: no hay un modo simulado. Los profesores entran con la cuenta de correo que ya usaban (Supabase Auth) y deben estar asignados a sus cursos por el director.

## Acceso sin conexión

- **Autenticar requiere conexión.** La contraseña solo la valida el servidor.
- **Preparación.** Tras un acceso correcto, el teléfono guarda el perfil (nombre, clase, género), el progreso local y un *refresh token* en IndexedDB. Las lecciones y las ilustraciones ya vienen en la app y se guardan en caché como el resto.
- **"Continuar como [nombre]".** Solo aparece para cuentas preparadas en ese teléfono. Sin internet abre los datos locales y no finge validar una contraseña. Con internet renueva el token y actualiza la clase, por si el profesor la cambió.
- **Cuenta no preparada.** Si alguien intenta entrar sin internet con una cuenta que el teléfono no tiene, ve: “Conéctate una vez para preparar tu cuenta en este teléfono”.
- **Teléfonos compartidos.** Al abrir la app no se entra automáticamente: cada estudiante elige su cuenta o se autentica. Cada estudiante tiene su XP, sus lecciones y su guardarropa aparte.
- **Cerrar sesión.** Borra el refresh token del teléfono y oculta los datos. Para volver hay que autenticarse.

## Pendiente

1. **Revocación sin conexión.** Si se cierra sesión sin internet, el refresh token queda válido en Supabase hasta que vence. Restablecer la contraseña tampoco cierra sesiones ya preparadas en otros teléfonos. Conviene revocarlas con la Admin API (`/admin/users/{id}/logout` o equivalente) al restablecer.
2. **Límite de intentos en memoria.** Vive en una sola instancia del backend. Con varias réplicas, moverlo a la base o a un proxy.
3. **Límites de Supabase Auth.** Todos los inicios de sesión salen desde la IP del backend. Revisar los límites de Auth en el panel de Supabase antes de usarlo con un salón completo.
4. **Progreso en el servidor.** Las lecciones se generan en el teléfono, mientras que el backend evalúa `actividad_versiones`. La cola offline todavía envía a `/api/progress/attempts`; falta adaptarla a `POST /api/attempts` y vincular las lecciones con actividades publicadas.
5. **Migraciones en Supabase.** V15 y V16 no se ejecutaron contra la base compartida. Se aplican al iniciar el backend con las credenciales reales.
