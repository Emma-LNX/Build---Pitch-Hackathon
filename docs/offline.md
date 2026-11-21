# Plan de trabajo offline

Implementado en la base: precaché de recursos estáticos de la interfaz mediante Vite PWA / Workbox. No hay caché runtime de endpoints.

Pendiente:

1. Descargar explícitamente temas y ejercicios elegidos por el estudiante; guardarlos en IndexedDB mediante `idb`, en `frontend/src/offline/storage`.
2. Guardar intentos locales con UUID, usuario, versión del ejercicio y estado pendiente.
3. Sincronizar al recuperar conexión y al abrir la aplicación desde `frontend/src/offline/sync`; no depender únicamente de Background Sync.
4. Integrar los reintentos con `POST /api/attempts`: el backend ya implementa idempotencia por UUID y validación de contenido para evitar duplicados. Reutilizar el UUID original de cada partida al sincronizar.
5. Definir expiración del contenido, manejo de conflictos y limpieza de datos al cerrar sesión o cambiar de cuenta.

Las respuestas de autenticación y el progreso privado no deben añadirse a reglas generales de caché HTTP. La evaluación offline y sus límites deben diseñarse antes de descargar soluciones. Reservar la sincronización final y la persistencia remota para cuando vuelva la conexión.
