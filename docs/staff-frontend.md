# Panel de profesores y directores (frontend)

Ruta: `/profe`. Conectado al backend existente; no usa servicios simulados. Los roles y colegios salen siempre del servidor (`GET /api/schools` y `GET /api/directors/me`), nunca del correo, `user_metadata` ni del claim `authenticated`.

## Configuración pública

El navegador habla directamente con Supabase Auth para registrarse, confirmar el correo, iniciar sesión, renovar y cerrar sesión. Solo necesita valores **públicos**:

| Variable | Dónde | Valor |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `frontend/.env.local` (desarrollo) o argumento de build | `https://TU_PROYECTO.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | igual | Clave pública `anon` del proyecto |

Vite lee también el `.env` raíz: `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` o `SUPABASE_ANON_KEY`. Los valores públicos no vacíos de `frontend/.env.local` tienen prioridad. Únicamente se incorporan al navegador la URL y la clave pública; las credenciales JDBC y `service_role` permanecen en el servidor.

Docker Compose pasa esos mismos valores como argumentos de compilación. Para desplegar, ejecutar primero `pnpm check:config` dentro de `frontend`; el comando muestra qué dato falta sin imprimir claves. El Dockerfile ejecuta esa comprobación antes del build para evitar publicar un acceso sin configurar. Cambiar una variable pública requiere volver a compilar la imagen del frontend.

La clave `SUPABASE_SERVICE_ROLE_KEY` se necesita adicionalmente en el backend para crear cuentas de estudiantes y restablecer contraseñas. No es necesaria para el acceso por correo de profesores/directores, y nunca debe usarse como clave pública.

En Supabase → Authentication:

- Habilitar Email y **Confirm email**.
- **Site URL** y **Redirect URLs**: añadir `https://TU_DOMINIO/profe`; en desarrollo, `http://localhost:5173/profe` y `http://localhost:4173/profe`. El enlace de confirmación vuelve ahí con los tokens en el fragmento (`#access_token=…&type=signup`); la app los toma y los borra de la URL. Un enlace vencido muestra “El enlace de confirmación venció…” y permite pedir otro.
- Para enviar correos fuera del equipo de Supabase se requiere SMTP propio (ver docs/directors.md).

## Sesión

- Token de acceso: solo en memoria. Refresh token: en `sessionStorage` (se borra al cerrar la pestaña); nunca en `localStorage` ni IndexedDB.
- Se renueva un minuto antes de vencer y, si la API responde 401, una vez más. Si no se puede renovar: “Tu sesión venció. Vuelve a entrar.”
- Cerrar sesión revoca la sesión en Supabase y borra el refresh token.
- El acceso de estudiantes (usuario + contraseña, `/api/auth/student/login`) no cambia.

## Contextos y roles

| Situación (según el servidor) | Qué ve |
| --- | --- |
| Registro hecho, correo sin confirmar | “Confirma tu correo”, con reenvío del enlace |
| Autenticado sin perfil de director (`/directors/me` → 404) y sin colegios | Explicación + “Activar perfil de director” (solo si lo elige) |
| Perfil de director activo sin colegios | Área de director con “Crear mi primer colegio” |
| Un solo contexto | Abre directamente ese panel |
| Varios roles o colegios | Selector “¿Dónde vas a trabajar?”; el encabezado muestra rol y colegio activos y “Cambiar” |

Cambiar de contexto desmonta el área anterior; todas las cargas se cancelan al cambiar de colegio, curso o cuenta, así que una respuesta tardía nunca aparece en otro contexto. Entrar como profesor no activa un perfil de director.

## Vistas y endpoints

### Director

| Vista | Endpoints |
| --- | --- |
| Inicio | `GET /schools/{s}/statistics` (conteos administrativos: profesores, estudiantes, cursos, temas, aulas) |
| Colegios | `GET /schools`, `POST /schools {name}` |
| Integrantes | `GET /schools/{s}/members`, `POST /schools/{s}/members {email, role}`, `DELETE /schools/{s}/members/{user}` |
| Cursos | `GET/POST /schools/{s}/courses`, `DELETE /schools/{s}/courses/{c}`, `GET /schools/{s}/courses/{c}/members`, `PUT` y `DELETE /schools/{s}/courses/{c}/members/{user}` (sin cuerpo) |
| Temas | `GET /schools/{s}/courses`, `GET /schools/{s}/courses/{c}/topics` (solo lectura) |
| Perfil | `GET /directors/me` |
| Activación | `POST /directors/register {name}` |

### Profesor

| Vista | Endpoints |
| --- | --- |
| Inicio | `GET /schools/{s}/courses`, `GET /schools/{s}/teachers/me` |
| Mis cursos | `GET /schools/{s}/courses` (solo los asignados) |
| Estudiantes | `GET /teacher/classes`, `GET/POST /teacher/classes/{c}/students`, `PUT /teacher/students/{u}/password`, `PUT /teacher/students/{u}/class` |
| Temas | `GET/POST /schools/{s}/courses/{c}/topics {title ≤160, content ≤20000}` |
| Aulas | `GET /schools/{s}/teachers/me`, `GET /schools/{s}/classrooms/{a}/statistics`, `GET /schools/{s}/classrooms/{a}/students`, `GET …/students/{e}/progress` |
| Perfil | `GET /schools`, `GET /schools/{s}/teachers/me`, `GET /schools/{s}/courses` |

Los temas de “Aulas” son los del catálogo global de práctica (tabla `temas`), distintos de los temas publicados en cursos (`topics`). No se relacionan entre sí.

## Errores y estados

Carga, vacío con siguiente paso, error con “Reintentar”, operación en curso (botón desactivado), éxito solo tras la respuesta del servidor, sin conexión y sesión vencida. 400 muestra los errores por campo de Problem Details; 403, 404 y 409 se explican según el endpoint (por ejemplo, 409 al añadir un integrante con otro rol o un usuario de estudiante repetido). Si una operación falla, el formulario se conserva.

## Sin conexión

El acceso y todas las operaciones administrativas requieren conexión. Sin internet se ven los datos ya cargados en la sesión abierta, con la hora de su última actualización, y los botones que modifican datos se desactivan. No se guardan respuestas privadas en caché ni en almacenamiento persistente.

## Funciones que el backend no ofrece (no implementadas)

- Editar o eliminar colegios; invitar por correo o crear cuentas de profesores desde la app.
- Que el profesor cree o elimine cursos, o administre membresías del colegio.
- Que el director publique temas.
- Relación entre temas de curso y ejercicios, asignación de actividades o resultados académicos por curso.
- Series históricas para gráficas de línea (los bocetos las muestran, pero no hay endpoint tipado).
- Administración de aulas (crear, editar, matricular, trasladar) en la interfaz: el backend la ofrece (docs/classrooms.md), pero no estaba en el alcance de estas vistas.
- El módulo `/estadisticas/profesor/*` responde mapas sin tipo; no se usa para no adivinar campos.

## Verificación de integración

- `pnpm test` en `frontend`: pruebas de sesión en StrictMode, confirmación por enlace, renovación concurrente, cierre de sesión durante una renovación, aislamiento de cuentas y respuestas tardías, revocación de permisos y continuidad de datos en memoria sin conexión. Incluye recorridos de acceso por correo, selección de contexto, creación de colegio y estudiante, alta/asignación de profesor y publicación de temas. Estas pruebas de interfaz simulan el transporte HTTP con los contratos reales; no utilizan cuentas de Supabase.
- `pnpm build`: TypeScript, bundle de producción y precaché PWA.
- `mvn verify`: pruebas del backend con autenticación y bases de prueba aisladas. Las suites PostgreSQL requieren Docker o `TEST_DB_URL` de una base desechable; sin ellos se omiten. No apuntar las pruebas a Supabase compartido.
- El merge con `main` conserva contactos y reportes a familias (V13–V14), aprendizaje adaptativo (V15) y cuentas por aula. Las migraciones nuevas de cuentas por curso se numeran V16–V17 para evitar duplicados de Flyway. No se modifican las migraciones publicadas de `main`.
- IndexedDB v4 actualiza los esquemas divergentes de ambas ramas. Las respuestas, dominio, diagnóstico y guardarropas quedan separados por estudiante. Las pruebas verifican actualizaciones desde v1, v2 y v3, recompensas idempotentes y sincronización exclusiva de la cuenta activa.
- El panel docente real está en `/profe`; la antigua ruta `/profesor` redirige a ese acceso. El informe local del estudiante se conserva como `/mi-aprendizaje`, dentro de su sesión.
- El acceso real con correo requiere configurar las dos variables públicas indicadas arriba y las URLs de confirmación en Supabase. Sin esa configuración se muestra un aviso, sin simular una sesión.
