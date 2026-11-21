# Contactos de padres y reportes

El profesor responsable de un aula puede guardar un contacto para cada alumno matriculado: nombre, relación (por ejemplo, madre, padre o tutor), correo y teléfono opcional. Puede corregirlo o eliminarlo. El director, otros profesores y los alumnos no tienen acceso a estos contactos por la API.

El profesor puede enviar el reporte manualmente. Además, el backend lo envía **automáticamente una vez por semana** a cada contacto. Genera el texto con las partidas y estadísticas actuales del alumno y usa únicamente el correo guardado. El cuerpo de la petición manual no puede elegir otro destinatario ni alterar las cifras. El mensaje incluye el aula, número de partidas, porcentaje de aprobación, puntaje promedio, actividades completadas y resultados por tema, indicando los temas que el profesor marcó como difíciles.

Por defecto se revisan los pendientes todos los días a las **08:00, hora de Guatemala**. La semana comienza el lunes. Un contacto agregado durante la semana entra en el siguiente ciclo semanal. Si el profesor ya envió el reporte manualmente durante la semana, no se repite automáticamente. Un fallo SMTP se reintenta en la revisión del día siguiente. La base de datos reserva cada contacto durante el envío para que dos instancias del backend no lo envíen simultáneamente; si el proceso se detiene justo después de entregar el correo y antes de guardar la confirmación, un reintento podría duplicarlo.

## API

Todas las rutas requieren Bearer JWT y comienzan con `/api/schools/{school}/classrooms/{classroom}/students/{student}/parents`.

| Método | Sufijo | Acción |
| --- | --- | --- |
| GET | `/` | Lista los contactos del alumno en el aula. |
| POST | `/` | Registra un contacto; devuelve `201`. |
| PUT | `/{parent}` | Corrige los datos del contacto. |
| DELETE | `/{parent}` | Elimina el contacto; devuelve `204`. |
| POST | `/{parent}/reports` | Envía el reporte al correo guardado y devuelve `parentId` y `sentAt`. |

Ejemplo para crear o actualizar:

```json
{
  "fullName": "María Pérez",
  "relationship": "Madre",
  "email": "maria@example.com",
  "phone": "+502 1234 5678"
}
```

El correo se normaliza a minúsculas. Un alumno no puede tener dos contactos con el mismo correo en la misma aula. Al trasladar al alumno a otra aula del mismo ciclo, el contacto pasa al nuevo profesor; al retirarlo del aula, se elimina. La cuenta del alumno y sus partidas se conservan.

## Configuración del correo

Agregar estas variables al `.env` **local** de la raíz para usar Docker Compose (o exportarlas en la terminal si se ejecuta Java sin Compose):

```dotenv
REPORT_SMTP_HOST=smtp.example.com
REPORT_SMTP_PORT=587
REPORT_SMTP_USERNAME=usuario-smtp
REPORT_SMTP_PASSWORD=contraseña-smtp
REPORT_SMTP_FROM=reportes@example.com
REPORT_SMTP_STARTTLS=true
REPORT_WEEKLY_CHECK_CRON="0 0 8 * * *"
REPORT_WEEKLY_ZONE=America/Guatemala
```

El remitente debe estar autorizado por el proveedor SMTP. Sin `REPORT_SMTP_HOST` y `REPORT_SMTP_FROM`, el backend arranca normalmente, pero el envío devuelve `503`. Si el servidor SMTP rechaza el mensaje, devuelve `502` y no marca el contacto como enviado. La prueba automatizada sustituye el envío real por un simulador; la entrega a una bandeja externa queda pendiente de configurar y probar con las credenciales del equipo.

V13 agrega `parent_contacts` con una clave foránea a la matrícula, revoca acceso directo de Supabase y habilita RLS sin políticas de cliente. V14 agrega la reserva temporal para evitar envíos semanales simultáneos. El correo no se verifica automáticamente en esta versión; antes de registrar el contacto, el colegio debe comprobar que pertenece a su padre o tutor.
