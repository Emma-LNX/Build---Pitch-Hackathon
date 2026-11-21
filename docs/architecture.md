# Arquitectura

El navegador consume `/api` en Spring Boot; Java conecta por JDBC a Supabase PostgreSQL. Vite durante desarrollo y Nginx en Docker mantienen el mismo origen para la API.

Frontend organizado por funcionalidades. Backend organizado por módulos. La primera funcionalidad implementada es el [RBAC por colegio y curso](rbac.md): autenticación con JWT de Supabase Auth y autorización por membresías verificadas en cada petición.

Se usa `JdbcTemplate` en los repositorios de membresías y temas para expresar explícitamente los filtros por usuario, colegio y curso. JPA sigue disponible para nuevos módulos; no genera tablas.

Flyway es el propietario de las migraciones en `backend/src/main/resources/db/migration`. Hibernate y Flyway usan el esquema `math_portal`. V1 define colegios, cursos, membresías y temas; V2 restringe el acceso directo desde Supabase y activa RLS sin políticas públicas. La conexión JDBC de propietario omite RLS: la API aplica la autorización en sus consultas.

Solo la salud del backend es pública. El director confirmado puede crear su propio colegio, administrar sus miembros, cursos y asignaciones y consultar estadísticas. V3 define los perfiles y la propiedad de colegios; V4 protege las tablas nuevas. Hay tres roles: DIRECTOR, PROFESOR y ALUMNO.

El frontend lo desarrolla otro integrante del equipo. La integración debe registrar usuarios con Supabase Auth y enviar sus access tokens a la API. La práctica de ejercicios y la sincronización offline quedan pendientes. El esquema privado no se consulta directamente desde el navegador. Nunca publicar contraseñas JDBC ni claves service-role.
