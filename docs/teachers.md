# Profesor: progreso de su aula

El profesor es un miembro `PROFESOR` del colegio. Su identidad es el `sub` del JWT de Supabase Auth; no se crea una contraseña ni un rol desde el cliente. El director lo asigna a un aula. Puede tener varias aulas y se consulta únicamente información de las que tiene asignadas. Si cambia el profesor de un aula, el anterior pierde acceso inmediatamente.

## Fuente de estadísticas

Las métricas usan las `partidas` evaluadas y guardadas por el módulo de alumnos. El porcentaje de aprobación usa `EstadisticasService.calcularPorcentajeAciertos` del commit de Chou: partidas aprobadas / partidas totales. `averageScore` es el promedio de `puntaje_porcentaje` de esas partidas y `completedActivities` cuenta actividades distintas con al menos una partida aprobada. Sin partidas, los valores son cero. `activeStudents` cuenta alumnos del aula con alguna partida.

`temas` es el catálogo global de actividades jugables, usado por `partidas`; `topics` contiene contenidos de los cursos de cada colegio. Los temas difíciles se seleccionan del catálogo `temas` y solo si ese alumno ya tiene al menos una partida del tema. El profesor decide si el porcentaje observado justifica marcarlo; no existe un umbral automático. El módulo de Chou registra tiempos opcionales en `estadistica_tiempos`; el resumen de aula usa partidas y sus puntajes, mientras `/api/estadisticas` ofrece el detalle de respuestas y tiempos.

El progreso del alumno se acumula en su perfil global, aunque cambie de aula o pertenezca a más de un colegio. La API exige matrícula actual en el aula antes de mostrarlo. Una selección de tema difícil pertenece a la matrícula del aula y se elimina si el alumno sale; al trasladarlo a otra aula del mismo ciclo se conserva con el nuevo responsable.

## Endpoints

Todos usan Bearer JWT de Supabase Auth y el prefijo `/api`:

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/schools/{school}/teachers/me` | Perfil del profesor y sus aulas de ese colegio. |
| GET | `/schools/{school}/classrooms/{classroom}/statistics` | Alumnos, alumnos con partidas, totales y estadísticas por tema. |
| GET | `/schools/{school}/classrooms/{classroom}/students/{student}/progress` | Alias, métricas y temas practicados de un alumno matriculado. |
| PUT | `/schools/{school}/classrooms/{classroom}/students/{student}/difficult-topics/{topic}` | Marca el tema; repetir la petición no crea duplicados. Devuelve el progreso actualizado. |
| DELETE | `/schools/{school}/classrooms/{classroom}/students/{student}/difficult-topics/{topic}` | Quita la marca; devuelve `204`. |

Ejemplo de progreso:

```json
{
  "studentId": "00000000-0000-4000-8000-000000000023",
  "alias": "Ana",
  "statistics": {
    "attempts": 2,
    "passedAttempts": 1,
    "passPercentage": 50.0,
    "averageScore": 75.00,
    "completedActivities": 1
  },
  "topics": [{
    "topicId": "00000000-0000-4000-8000-000000000071",
    "name": "Sumas",
    "attempts": 2,
    "passedAttempts": 1,
    "passPercentage": 50.0,
    "averageScore": 75.00,
    "lastAttemptAt": "2026-11-21T18:00:00Z",
    "difficult": true
  }]
}
```

El servicio comprueba el colegio, el aula, su profesor asignado y la matrícula del alumno para cada operación. Responde `404` para recursos ajenos o inexistentes y `401` sin token. El director mantiene su endpoint administrativo de conteos en `/schools/{school}/statistics`.

## Persistencia y verificación

V1/V2 incorporan las tablas y el ejemplo de práctica del módulo de alumnos de `main`; V7 contiene las estadísticas de Chou. V10 bloquea acceso directo a las tablas de alumnos; V11 guarda los temas difíciles con claves compuestas de escuela, aula y alumno; V12 bloquea acceso directo a esa selección. Flyway aplicará las migraciones al arrancar en Supabase. No se lee ni se modifica `.env`.

`mvn test` ejecuta pruebas de autorización entre profesores, estadísticas desde partidas reales, selección idempotente y temas no practicados. La suite de alumnos que requiere Docker o `TEST_DB_URL` se omite si no hay PostgreSQL disponible. Las migraciones V1–V12 se verificaron además en PostgreSQL embebido.
