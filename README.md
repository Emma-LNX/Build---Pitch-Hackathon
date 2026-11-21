# Portal de repaso de matemáticas

MayaMente incluye [paneles de profesor y director](docs/staff-frontend.md), acceso de [estudiantes con cuentas creadas por su profesor](docs/cuentas-estudiantes.md) y [guardarropa de avatares](docs/guardarropa.md). Configurar las variables públicas de Supabase indicadas en la guía del panel antes de compilar el frontend para usar el acceso por correo.

Monorepo inicial para Build & Pitch Hackathon. Incluye la estructura base y RBAC en la API con separación por colegio y curso. Ver [roles, endpoints y configuración](docs/rbac.md). Incluye la API de registro y administración de directores; ver [contrato de integración](docs/directors.md). El frontend lo desarrolla otro integrante del equipo. Incluye [aulas por escuela, grado, sección y ciclo](docs/classrooms.md), con profesor y matrícula de estudiantes, [estadísticas del profesor](docs/teachers.md) y [reportes semanales por correo a padres](docs/parents.md). La experiencia de práctica offline está pendiente.

```text
.
├── frontend/                   # React + TypeScript + Vite (PWA)
│   ├── public/icons/
│   └── src/
│       ├── app/                # Entrada, rutas y proveedores
│       ├── assets/
│       ├── components/         # Componentes compartidos
│       ├── features/
│       │   ├── auth/
│       │   ├── topics/
│       │   ├── exercises/
│       │   └── progress/
│       ├── hooks/
│       ├── lib/                # Cliente HTTP y utilidades
│       ├── offline/
│       │   ├── storage/        # IndexedDB: contenido descargado
│       │   └── sync/           # Cola de intentos por sincronizar
│       ├── styles/
│       └── types/
├── backend/                    # Java 21 + Spring Boot + Maven
│   └── src/
│       ├── main/
│       │   ├── java/com/hackathon/mathportal/
│       │   │   ├── config/
│       │   │   ├── common/exception/
│       │   │   └── modules/{auth,directors,schools,classrooms,teachers,parents,students,courses,topics,exercises,progress,Estadistica}/
│       │   └── resources/db/migration/
│       └── test/java/com/hackathon/mathportal/
├── docs/                       # Arquitectura y decisiones offline
├── infra/nginx/                # Proxy del frontend a la API
└── compose.yaml
```

Cada módulo del backend reserva `controller`, `service`, `repository`, `entity` y `dto`. Las carpetas vacías llevan `.gitkeep` para conservarlas en Git.

## Dependencias

- Frontend: React, React DOM, React Router, `idb` (IndexedDB).
- Herramientas frontend: TypeScript, Vite, plugin React, `vite-plugin-pwa` (Workbox).
- Backend: Spring Web, Security / OAuth2 Resource Server, Data JPA / JDBC, Validation, Actuator, Mail, driver PostgreSQL, Flyway y soporte Flyway PostgreSQL. H2 se usa solo en pruebas. Spring Boot administra sus versiones.
- Desarrollo: Node.js 22.12+ con pnpm 11.25.0 (instalar con `npm install -g pnpm@11.25.0`), JDK 21, Maven 3.6.3+ o Docker con Compose v2.

Se usa Spring Boot 3.5.16 con Java 21. Supabase se conecta desde Java mediante JDBC; no hace falta un SDK de Supabase para acceder a PostgreSQL. La API valida access tokens de Supabase Auth con claves asimétricas. Supabase Auth gestiona el registro por correo; la API activa el perfil de director solo después de confirmarlo.

## Inicio con Docker

1. Copiar `.env.example` a `.env` y completar las credenciales PostgreSQL y `SUPABASE_AUTH_ISSUER`; configurar la confirmación de correo y Redirect URLs según [Directores](docs/directors.md).
2. Ejecutar `docker compose up --build`.
3. Abrir http://localhost:8080. Salud de la API: http://localhost:8080/api/actuator/health.

En Supabase, usar la conexión directa si hay IPv6 o el **Session pooler** en puerto 5432 si se necesita IPv4. Copiar host, usuario y contraseña desde el panel Connect. La contraseña solo va en `.env`, nunca en variables `VITE_*`. No se levanta otro PostgreSQL local: la base de datos vive en Supabase.

## Desarrollo sin Docker

Frontend:

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Backend, con `SUPABASE_DB_URL`, `SUPABASE_DB_USERNAME`, `SUPABASE_DB_PASSWORD` y `SUPABASE_AUTH_ISSUER` exportadas en la terminal:

```sh
cd backend
mvn spring-boot:run
```

Maven no carga el `.env` de Compose automáticamente. Vite usa el proxy local hacia `http://localhost:8081`; en Docker, Nginx envía `/api` al backend.

Validación: `pnpm build` dentro de `frontend`, `mvn verify` dentro de `backend` y `docker compose config --quiet` desde la raíz con `.env` configurado.

## Alcance PWA / offline

La configuración inicial genera el manifest y el service worker, y precachea la interfaz compilada. Solo funciona offline tras una primera visita online con el service worker instalado; se requiere HTTPS en despliegue o localhost en desarrollo. Para probar: `pnpm build` y `pnpm preview`.

La descarga de lecciones, el almacenamiento de ejercicios y la sincronización del progreso aún deben implementarse en `src/offline/`. No se cachean respuestas de la API ni datos privados automáticamente. Faltan iconos PNG de 192×192 y 512×512 para completar los requisitos de instalación en los navegadores objetivo; ver `frontend/public/icons/README.md`.

Fuentes: [Spring Boot / Java](https://docs.spring.io/spring-boot/3.5/system-requirements.html), [Vite PWA](https://vite-pwa-org.netlify.app/guide/), [Supabase con Spring Boot](https://supabase.com/docs/guides/getting-started/quickstarts/spring-boot).

## Backend de alumnos integrado

Se conserva el backend de alumnos, partidas, XP, niveles, ranking y rachas. Ver [guía del backend](backend/README.md) y [contexto de alumnos](docs/contexto-alumnos.md). Los temas de práctica globales (tabla temas) y los temas publicados por profesores dentro de cursos (tabla topics) conservan ámbitos separados; todavía no existe una vinculación entre ambos. La sincronización de partidas usa POST /api/attempts con UUID idempotente. Las migraciones de alumnos son V1–V2, colegios/directores V3–V6, estadísticas V7 y aulas/profesores V8–V12. El emisor se puede configurar con SUPABASE_AUTH_ISSUER o derivar de SUPABASE_URL.
