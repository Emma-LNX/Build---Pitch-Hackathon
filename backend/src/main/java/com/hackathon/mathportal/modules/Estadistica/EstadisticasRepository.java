package com.hackathon.mathportal.modules.Estadistica;

import com.hackathon.mathportal.common.PageResponse;
import com.hackathon.mathportal.modules.Estadistica.EstadisticasDtos.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class EstadisticasRepository {
    public enum Historial { DESAFIOS, NIVELES, ERRORES }
    private final JdbcTemplate jdbc;

    public EstadisticasRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // Relacion mediante el subject verificado y roles de BD, nunca claims de rol del JWT.
    private static final String ASIGNADO = """
        EXISTS (
            SELECT 1 FROM math_portal.course_memberships profesor
            JOIN math_portal.course_memberships estudiante
              ON estudiante.school_id = profesor.school_id AND estudiante.course_id = profesor.course_id
            WHERE profesor.user_id = ? AND profesor.role = 'PROFESOR'
              AND estudiante.role = 'ALUMNO' AND CAST(estudiante.user_id AS varchar) = a.auth_subject)
        """;

    public Optional<Alumno> propia(String subject) {
        return jdbc.query("""
            SELECT id, alias, zona_horaria FROM math_portal.alumnos
            WHERE auth_subject = ? AND estado = 'ACTIVO'
            """, (rs, row) -> new Alumno(rs.getObject("id", UUID.class), rs.getString("alias"),
                rs.getString("zona_horaria")), subject).stream().findFirst();
    }

    public Optional<Alumno> asignada(UUID profesor, UUID alumno) {
        return jdbc.query("""
            SELECT a.id, a.alias, a.zona_horaria FROM math_portal.alumnos a
            WHERE a.id = ? AND a.estado = 'ACTIVO' AND
            """ + ASIGNADO, (rs, row) -> new Alumno(rs.getObject("id", UUID.class),
                rs.getString("alias"), rs.getString("zona_horaria")), alumno, profesor).stream().findFirst();
    }

    public boolean esProfesor(UUID subject) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM math_portal.school_memberships
                WHERE user_id = ? AND role = 'PROFESOR')
            """, Boolean.class, subject));
    }

    public PageResponse<Map<String, Object>> alumnos(UUID profesor, int page, int size) {
        var pageable = PageResponse.request(page, size);
        String from = " FROM math_portal.alumnos a WHERE a.estado = 'ACTIVO' AND " + ASIGNADO;
        long total = jdbc.queryForObject("SELECT count(*)" + from, Long.class, profesor);
        var rows = rows("SELECT a.id AS alumno_id, a.alias" + from
            + " ORDER BY a.alias, a.id LIMIT ? OFFSET ?", profesor, size, pageable.getOffset());
        return pagina(rows, page, size, total);
    }

    public Map<String, Object> nivel(UUID alumno) {
        return rows("""
            WITH xp AS (SELECT coalesce(sum(cantidad), 0) AS total
                FROM math_portal.movimientos_puntos WHERE alumno_id = ?)
            SELECT xp.total AS xp_total, n.numero AS nivel_numero, n.nombre AS nivel_nombre,
                n.xp_minimos AS xp_inicio_nivel,
                (SELECT min(xp_minimos) FROM math_portal.niveles_alumno WHERE xp_minimos > xp.total)
                    AS xp_siguiente_nivel,
                CASE WHEN NOT EXISTS (SELECT 1 FROM math_portal.niveles_alumno WHERE xp_minimos > xp.total)
                    THEN 100.00
                    ELSE round(100.0 * (xp.total - n.xp_minimos) /
                        ((SELECT min(xp_minimos) FROM math_portal.niveles_alumno WHERE xp_minimos > xp.total)
                        - n.xp_minimos), 2) END AS porcentaje_avance
            FROM xp JOIN math_portal.niveles_alumno n ON n.id = (
                SELECT id FROM math_portal.niveles_alumno WHERE xp_minimos <= xp.total
                ORDER BY xp_minimos DESC LIMIT 1)
            """, alumno).getFirst();
    }

    public Map<String, Object> totales(UUID alumno) {
        return rows("""
            SELECT count(*) AS partidas_terminadas,
                count(DISTINCT v.actividad_id) AS desafios_intentados,
                count(DISTINCT CASE WHEN p.aprobada THEN v.actividad_id END) AS desafios_completados,
                coalesce(sum(r.aciertos), 0) AS aciertos, coalesce(sum(r.preguntas), 0) AS preguntas,
                round(100.0 * sum(r.aciertos) / nullif(sum(r.preguntas), 0), 2) AS porcentaje_aciertos,
                count(t.partida_id) AS partidas_con_tiempo,
                sum(t.tiempo_activo_ms) AS tiempo_activo_ms,
                sum(t.tiempo_transcurrido_ms) AS tiempo_transcurrido_ms
            FROM math_portal.partidas p
            JOIN math_portal.actividad_versiones v ON v.id = p.actividad_version_id
            LEFT JOIN (SELECT partida_id, count(*) AS preguntas,
                sum(CASE WHEN correcta THEN 1 ELSE 0 END) AS aciertos
                FROM math_portal.estadistica_respuestas GROUP BY partida_id) r ON r.partida_id = p.id
            LEFT JOIN math_portal.estadistica_tiempos t ON t.partida_id = p.id
            WHERE p.alumno_id = ?
            """, alumno).getFirst();
    }

    public List<Map<String, Object>> temas(UUID alumno) {
        return rows("""
            SELECT a.tema_id, tema.nombre AS tema, count(*) AS preguntas,
                sum(CASE WHEN r.correcta THEN 1 ELSE 0 END) AS aciertos,
                sum(CASE WHEN r.correcta THEN 0 ELSE 1 END) AS errores,
                round(100.0 * sum(CASE WHEN r.correcta THEN 1 ELSE 0 END) / count(*), 2)
                    AS porcentaje_aciertos
            FROM math_portal.estadistica_respuestas r
            JOIN math_portal.partidas p ON p.id = r.partida_id
            JOIN math_portal.actividad_versiones v ON v.id = p.actividad_version_id
            JOIN math_portal.actividades a ON a.id = v.actividad_id
            JOIN math_portal.temas tema ON tema.id = a.tema_id
            WHERE p.alumno_id = ? GROUP BY a.tema_id, tema.nombre ORDER BY tema.nombre, a.tema_id
            """, alumno);
    }

    public List<Map<String, Object>> tiempos(UUID alumno) {
        return rows("""
            SELECT v.actividad_id, a.titulo, count(*) AS partidas_terminadas,
                count(t.partida_id) AS partidas_con_tiempo,
                round(avg(t.tiempo_transcurrido_ms), 2) AS promedio_transcurrido_ms,
                round(avg(t.tiempo_activo_ms), 2) AS promedio_activo_ms,
                sum(t.tiempo_activo_ms) AS tiempo_activo_ms
            FROM math_portal.partidas p
            JOIN math_portal.actividad_versiones v ON v.id = p.actividad_version_id
            JOIN math_portal.actividades a ON a.id = v.actividad_id
            LEFT JOIN math_portal.estadistica_tiempos t ON t.partida_id = p.id
            WHERE p.alumno_id = ? GROUP BY v.actividad_id, a.titulo ORDER BY a.titulo, v.actividad_id
            """, alumno);
    }

    public List<LocalDate> dias(UUID alumno) {
        // La practica incluye intentos fallidos; dias_aprendizaje solo contiene dias aprobados.
        return jdbc.query("""
            SELECT DISTINCT fecha_aprendizaje FROM math_portal.partidas WHERE alumno_id = ?
            ORDER BY fecha_aprendizaje
            """, (rs, row) -> rs.getObject(1, LocalDate.class), alumno);
    }

    public PageResponse<Map<String, Object>> historial(UUID alumno, Historial tipo, int page, int size) {
        var pageable = PageResponse.request(page, size);
        String select;
        String from;
        String order;
        switch (tipo) {
            case DESAFIOS -> {
                select = """
                    SELECT p.id AS partida_id, v.actividad_id, a.titulo, a.tema_id, p.aprobada,
                        p.puntaje_porcentaje AS porcentaje_aciertos, p.recibida_en,
                        (SELECT count(*) FROM math_portal.estadistica_respuestas r
                            WHERE r.partida_id = p.id AND r.correcta) AS aciertos,
                        (SELECT count(*) FROM math_portal.estadistica_respuestas r
                            WHERE r.partida_id = p.id) AS preguntas,
                        t.iniciada_en, t.finalizada_en, t.tiempo_transcurrido_ms, t.tiempo_activo_ms,
                        t.fuente AS fuente_tiempo
                    """;
                from = """
                     FROM math_portal.partidas p
                     JOIN math_portal.actividad_versiones v ON v.id = p.actividad_version_id
                     JOIN math_portal.actividades a ON a.id = v.actividad_id
                     LEFT JOIN math_portal.estadistica_tiempos t ON t.partida_id = p.id
                     WHERE p.alumno_id = ?
                    """;
                order = "p.recibida_en DESC, p.id";
            }
            case NIVELES -> {
                select = """
                    SELECT h.partida_id, h.registrado_en, h.xp_total, h.nivel_numero,
                        h.nivel_nombre, h.reconstruido
                    """;
                from = " FROM math_portal.estadistica_niveles h WHERE h.alumno_id = ?";
                order = "h.registrado_en DESC, h.xp_total DESC, h.partida_id";
            }
            case ERRORES -> {
                select = """
                    SELECT p.id AS partida_id, p.actividad_version_id, v.actividad_id, a.tema_id,
                        p.recibida_en, r.pregunta_id, r.respuesta_elegida, r.respuesta_elegida IS NULL AS omitida
                    """;
                from = """
                     FROM math_portal.estadistica_respuestas r
                     JOIN math_portal.partidas p ON p.id = r.partida_id
                     JOIN math_portal.actividad_versiones v ON v.id = p.actividad_version_id
                     JOIN math_portal.actividades a ON a.id = v.actividad_id
                     WHERE p.alumno_id = ? AND NOT r.correcta
                    """;
                order = "p.recibida_en DESC, p.id, r.pregunta_id";
            }
            default -> throw new IllegalArgumentException("Historial desconocido");
        }
        long total = jdbc.queryForObject("SELECT count(*)" + from, Long.class, alumno);
        return pagina(rows(select + from + " ORDER BY " + order + " LIMIT ? OFFSET ?",
            alumno, size, pageable.getOffset()), page, size, total);
    }

    public Optional<Instant> partidaRecibida(UUID alumno, UUID partida) {
        return jdbc.query("SELECT recibida_en FROM math_portal.partidas WHERE alumno_id = ? AND id = ?",
            (rs, row) -> rs.getTimestamp(1).toInstant(), alumno, partida).stream().findFirst();
    }

    public void guardarTiempo(UUID alumno, UUID partida, RegistrarTiempo tiempo) {
        jdbc.update("""
            INSERT INTO math_portal.estadistica_tiempos
                (partida_id, iniciada_en, finalizada_en, tiempo_activo_ms)
            SELECT id, ?, ?, ? FROM math_portal.partidas WHERE alumno_id = ? AND id = ?
            ON CONFLICT (partida_id) DO NOTHING
            """, Timestamp.from(tiempo.iniciadaEn()), Timestamp.from(tiempo.finalizadaEn()),
            tiempo.tiempoActivoMs(), alumno, partida);
    }

    public Tiempo tiempo(UUID alumno, UUID partida) {
        return jdbc.query("""
            SELECT t.* FROM math_portal.estadistica_tiempos t
            JOIN math_portal.partidas p ON p.id = t.partida_id WHERE p.alumno_id = ? AND p.id = ?
            """, (rs, row) -> new Tiempo(partida, rs.getTimestamp("iniciada_en").toInstant(),
                rs.getTimestamp("finalizada_en").toInstant(), rs.getLong("tiempo_transcurrido_ms"),
                rs.getLong("tiempo_activo_ms"), rs.getString("fuente")), alumno, partida).getFirst();
    }

    private List<Map<String, Object>> rows(String sql, Object... args) {
        var result = jdbc.queryForList(sql, args);
        result.forEach(row -> row.replaceAll((key, value) -> {
            if (value instanceof Timestamp timestamp) return timestamp.toInstant();
            if (value instanceof java.sql.Date date) return date.toLocalDate();
            if (value instanceof java.time.OffsetDateTime date) return date.toInstant();
            return value;
        }));
        return result;
    }

    private PageResponse<Map<String, Object>> pagina(List<Map<String, Object>> rows,
            int page, int size, long total) {
        return new PageResponse<>(rows, page, size, total, (total + size - 1) / size);
    }
}