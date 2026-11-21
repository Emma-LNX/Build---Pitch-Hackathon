# Aprendizaje adaptativo (4.º primaria)

La app del alumno funciona sin internet y decide qué practicar según sus errores.
Este documento explica qué datos genera y cómo conectarlos al módulo de estadísticas.

## Qué hace hoy (solo frontend)

- **Expedición** (`/diagnostico`): 14 retos, 2 por categoría. Si acierta, el siguiente es más difícil; si falla, más fácil.
- **Misión del día** (`/mision`): 8 retos que priorizan las categorías más débiles y cierran con la más fuerte.
- **Lecciones del mapa**: la dificultad se ajusta al nivel de la categoría de la lección.
- **Vista del profesor** (`/profesor`): reporte del alumno con los datos del dispositivo y descarga en CSV.

## Categorías (CNB 4.º)

| `category` | Nombre | CNB |
|---|---|---|
| `numeros` | Números y valor posicional | 4.1.2–4.1.4 |
| `maya` | Numeración maya | 4.1.7, 4.1.9, 4.8 |
| `suma-resta` | Suma y resta | 4.3 |
| `mult-div` | Multiplicación y división | 4.4, 4.6 |
| `fracciones` | Fracciones | 4.10 |
| `geometria` | Geometría | 1.1, 1.3, 1.5 |
| `medidas` | Medidas y dinero | 7.1, 7.7 |

Definidas en `frontend/src/features/curriculum/catalog.ts`.

## Dato por respuesta (`AnswerRecord`)

Cada reto respondido se guarda en IndexedDB (store `answers`, `frontend/src/offline/storage/db.ts`):

| Campo | Ejemplo | Significado |
|---|---|---|
| `id` | uuid | Único: sirve para ignorar duplicados al sincronizar |
| `sessionId` | uuid | Agrupa los retos de una expedición, misión o lección |
| `source` | `DIAGNOSTICO` / `ENTRENAMIENTO` / `LECCION` | De dónde vino |
| `category` | `fracciones` | Categoría del CNB |
| `exercise` | `fraccion-sumar` | Tipo de ejercicio |
| `difficulty` | `1`, `2`, `3` | 1 = refuerzo, 2 = nivel de grado, 3 = reto |
| `interaction` | `choice`, `number`, `maya`, `coins`, `slices`, `blocks`, `order` | Opciones, teclado o minijuego |
| `correct` | `true` | Si acertó |
| `errorTag` | `suma-denominadores` | Error detectado (`null` si acertó, `otro` si no se reconoce) |
| `timeMs` | `5300` | Tiempo para responder |
| `answeredAt` | ISO 8601 | Fecha y hora |

Los textos de cada `errorTag` están en `frontend/src/features/adaptive/errors.ts`.

## Nivel por categoría

Modelo tipo Elo en `frontend/src/features/adaptive/engine.ts`:

- Cada categoría tiene una habilidad `theta` que empieza en 0.
- Dificultad del reto: `b = difficulty - 2`.
- Probabilidad de acierto: `p = 1 / (1 + e^-(theta - b))`.
- Después de cada respuesta: `theta += K * (acierto - p)`, con `K = 0.8` en la expedición y `0.3` en la práctica.
- Puntaje: `100 * p` con `b = 0`. Niveles: Semilla (<40), Brote (40–59), Milpa (60–74), Elote (75–89), Mazorca (≥90).
- Se recalcula repitiendo todas las respuestas en orden de fecha, así que el servidor puede obtener el mismo resultado.

## Cómo conectarlo al servidor (pendiente)

1. **Migración `V15`**: tabla `math_portal.aprendizaje_respuestas` con los campos de arriba más `alumno_id`. Clave primaria `id` para ignorar reenvíos.
2. **`POST /api/aprendizaje/respuestas`** (alumno autenticado): recibe un arreglo de `AnswerRecord` y guarda solo los que no existan.
3. **`GET /api/schools/{school}/classrooms/{classroom}/students/{student}/aprendizaje`** (profesor del aula o director): nivel por categoría, aciertos, tiempo promedio y errores frecuentes. Debe devolver lo mismo que muestra `/profesor`.
4. **Frontend**: cuando el alumno entra con usuario y contraseña (`frontend/src/lib/supabase.ts`, `getAccessToken`), enviar las respuestas sin `syncedAt` con ese token y marcarlas como enviadas. El envío actual (`frontend/src/offline/sync/syncQueue.ts`) apunta a una ruta que no existe y se puede reemplazar.
5. **Profesor**: los temas difíciles que marca el profesor (`teacher_focus_topics`) pueden pasarse a `planMission(..., { focus })` para que la misión los priorice.
