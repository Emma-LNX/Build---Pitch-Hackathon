# Arquitectura inicial

El navegador consume `/api` en Spring Boot; Java conecta por JDBC a Supabase PostgreSQL. Vite durante desarrollo y Nginx en Docker mantienen el mismo origen para la API. No se requiere CORS abierto.

Frontend organizado por funcionalidades. Backend organizado por módulos, cada uno con capas controller, service, repository, entity y dto. Los módulos están reservados y no contienen lógica todavía.

Flyway será el único propietario de las migraciones, en `backend/src/main/resources/db/migration`. Se reserva el esquema `math_portal` para no mezclar las tablas con los esquemas administrados por Supabase. Hibernate y Flyway están configurados para usar ese esquema. JPA valida el esquema; no crea tablas automáticamente.

Autenticación y autorización quedan pendientes antes de exponer datos de alumnos. Si se usa Supabase Auth, el backend deberá validar sus JWT y comprobar el usuario de cada recurso. El acceso JDBC con usuario PostgreSQL no hereda automáticamente las políticas por usuario de Supabase Auth.

No se incluye un SDK de Supabase en el navegador: agregarlo solo si se decide usar Auth o Storage directamente desde el frontend. Nunca publicar contraseñas JDBC ni claves service-role.
