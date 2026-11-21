# Arquitectura inicial

El navegador consume `/api` en Spring Boot; Java conecta por JDBC a Supabase PostgreSQL. Vite durante desarrollo y Nginx en Docker mantienen el mismo origen para la API. No se requiere CORS abierto.

Frontend organizado por funcionalidades. Backend organizado por módulos, cada uno con capas controller, service, repository, entity y dto. Los módulos de alumnos, contenido y progreso implementan el MVP descrito en [el contexto de alumnos](contexto-alumnos.md) y [la guía del backend](../backend/README.md).

Flyway será el único propietario de las migraciones, en `backend/src/main/resources/db/migration`. Se reserva el esquema `math_portal` para no mezclar las tablas con los esquemas administrados por Supabase. Hibernate y Flyway están configurados para usar ese esquema. JPA valida el esquema; no crea tablas automáticamente.

Spring Security valida los JWT de Supabase Auth mediante su JWKS, emisor y audiencia. Los servicios privados resuelven al alumno desde el `sub` autenticado y comprueban que esté activo. El acceso JDBC con usuario PostgreSQL no hereda automáticamente las políticas por usuario de Supabase Auth; la autorización se aplica en Java. Solo la comprobación de salud es pública.

No se incluye un SDK de Supabase en el navegador: agregarlo solo si se decide usar Auth o Storage directamente desde el frontend. Nunca publicar contraseñas JDBC ni claves service-role.
