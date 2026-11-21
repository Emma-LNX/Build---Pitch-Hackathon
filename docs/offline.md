# Plan de trabajo offline

Implementado:

- Precaché de toda la interfaz (≈380 KB, incluye fuente e iconos) con Vite PWA / Workbox. Tras la primera visita la app abre sin internet.
- Ejercicios generados en el navegador (`frontend/src/features/exercises/generators.ts`): no hace falta descargar contenido para practicar.
- Perfil, estrellas, XP, racha y aciertos por habilidad en IndexedDB (`frontend/src/offline/storage/db.ts`). Se pide `navigator.storage.persist()` para que el navegador no borre los datos.
- Cola `outbox` de intentos con UUID (`frontend/src/offline/sync/syncQueue.ts`). Se envía al abrir la app, al volver la conexión y al terminar cada lección; si falla, se conserva.

Contrato que espera el frontend (pendiente en backend):

```http
POST /api/progress/attempts
Content-Type: application/json

[{ "id": "uuid", "studentId": "uuid", "lessonId": "tikal-1", "correct": 4, "total": 5,
   "skillResults": [{ "skill": "valor-posicional", "correct": true }], "createdAt": "ISO-8601" }]
```

Responder 2xx solo cuando todos quedaron guardados; ignorar los `id` repetidos (idempotencia). `studentId` lo genera hoy el teléfono al registrarse; se reemplazará al implementar autenticación.

Pendiente:

1. Implementar idempotencia en backend para evitar duplicados tras reintentos.
2. Definir expiración del contenido, manejo de conflictos y limpieza de datos al cerrar sesión o cambiar de cuenta.

Las respuestas de autenticación y el progreso privado no deben añadirse a reglas generales de caché HTTP. La evaluación offline y sus límites deben diseñarse antes de descargar soluciones. Reservar la sincronización final y la persistencia remota para cuando vuelva la conexión.
