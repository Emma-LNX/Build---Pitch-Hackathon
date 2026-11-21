# Arquitectura

El navegador consume `/api` en Spring Boot; Java conecta por JDBC a Supabase PostgreSQL. Vite durante desarrollo y Nginx en Docker mantienen el mismo origen para la API.

Frontend organizado por funcionalidades. Backend organizado por módulos. La primera funcionalidad implementada es el [RBAC por colegio y curso](rbac.md): autenticación con JWT de Supabase Auth y autorización por membresías verificadas en cada petición.

Se usa `JdbcTemplate` en los repositorios de membresías y temas para expresar explícitamente los filtros por usuario, colegio y curso. JPA sigue disponible para nuevos módulos; no genera tablas.

Flyway es el propietario de las migraciones en `backend/src/main/resources/db/migration`. Hibernate y Flyway usan el esquema `math_portal`. V1–V2 definen alumnos y ejercicios; V3–V4 colegios, cursos, membresías y RLS; V5–V6 directores; V7 estadísticas de Chou. La conexión JDBC de propietario omite RLS: la API aplica la autorización en sus consultas.

Solo la salud del backend es pública. El director confirmado puede crear su propio colegio, administrar sus miembros, cursos y asignaciones y consultar estadísticas. Hay tres roles: DIRECTOR, PROFESOR y ALUMNO.

El frontend lo desarrolla otro integrante del equipo. La integración debe registrar usuarios con Supabase Auth y enviar sus access tokens a la API. La API ya guarda partidas; la sincronización offline del cliente queda pendiente. El esquema privado no se consulta directamente desde el navegador. Nunca publicar contraseñas JDBC ni claves service-role.

## Backend de alumnos integrado

Se conserva el backend de alumnos, partidas, XP, niveles, ranking y rachas. Ver [guía del backend](../backend/README.md) y [contexto de alumnos](contexto-alumnos.md). Los temas de práctica globales (tabla temas) y los temas publicados por profesores dentro de cursos (tabla topics) conservan ámbitos separados; todavía no existe una vinculación entre ambos. La sincronización de partidas usa POST /api/attempts con UUID idempotente. El emisor se puede configurar con SUPABASE_AUTH_ISSUER o derivar de SUPABASE_URL.

El módulo [classrooms](classrooms.md) organiza aulas por escuela, grado, sección y ciclo escolar, con un profesor y matrícula de alumnos. V8 crea el modelo y V9 protege sus tablas. Los cursos permanecen independientes. La autorización administrativa se comparte mediante SchoolAdministrationAccess dentro de transacciones Spring.

El módulo [teachers](teachers.md) consulta las partidas del alumno y los porcentajes de `EstadisticasService` de Chou. Comprueba la asignación al aula antes de cada consulta. V10 protege las tablas de alumnos, V11 guarda los temas difíciles y V12 protege esa selección.

El módulo [parents](parents.md) guarda contactos vinculados a la matrícula y envía reportes de progreso por SMTP a petición del profesor o automáticamente cada semana. V13 protege estos contactos con RLS y sin acceso directo de cliente; V14 coordina los envíos semanales.
