package com.hackathon.mathportal.modules.Estadistica;

import com.hackathon.mathportal.modules.Estadistica.AprendizajeDtos.Respuesta;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AprendizajeRepository {
    private final JdbcTemplate jdbc;

    public AprendizajeRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Fila(String origen, String categoria, int dificultad, boolean correcta, String errorTag,
            long tiempoMs) {}

    public record AlumnoDeAula(UUID alumnoId, UUID studentId, String alias, String email, Instant ultimaRespuesta) {}

    /** Profesor responsable del aula o director de su escuela. */
    public boolean puedeVerAula(UUID actor, UUID classroom) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM math_portal.classrooms c
                WHERE c.id = ? AND (c.teacher_id = ? OR EXISTS(
                    SELECT 1 FROM math_portal.school_directors d WHERE d.school_id = c.school_id AND d.user_id = ?)))
            """, Boolean.class, classroom, actor, actor));
    }

    public List<AlumnoDeAula> alumnosDelAula(UUID classroom) {
        return jdbc.query("""
            SELECT a.id, cs.student_id, a.alias, u.email,
                   (SELECT MAX(r.respondida_en) FROM math_portal.aprendizaje_respuestas r WHERE r.alumno_id = a.id) AS ultima
            FROM math_portal.classroom_students cs
            JOIN math_portal.alumnos a ON a.auth_subject = CAST(cs.student_id AS varchar) AND a.estado = 'ACTIVO'
            LEFT JOIN auth.users u ON u.id = cs.student_id
            WHERE cs.classroom_id = ?
            ORDER BY a.alias, a.id
            """, (rs, row) -> {
                Timestamp ultima = rs.getTimestamp("ultima");
                return new AlumnoDeAula(rs.getObject("id", UUID.class), rs.getObject("student_id", UUID.class),
                    rs.getString("alias"), rs.getString("email"), ultima == null ? null : ultima.toInstant());
            }, classroom);
    }

    public int guardar(UUID alumno, List<Respuesta> respuestas) {
        int nuevas = 0;
        for (Respuesta r : respuestas) {
            nuevas += jdbc.update("""
                INSERT INTO math_portal.aprendizaje_respuestas
                    (id, alumno_id, sesion_id, origen, categoria, ejercicio, dificultad, interaccion,
                     correcta, error_tag, tiempo_ms, respondida_en)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO NOTHING
                """, r.id(), alumno, r.sessionId(), r.source(), r.category(), r.exercise(), r.difficulty(),
                r.interaction(), r.correct(), r.errorTag(), r.timeMs(), Timestamp.from(r.answeredAt()));
        }
        return nuevas;
    }

    public List<Fila> respuestas(UUID alumno) {
        return jdbc.query("""
            SELECT origen, categoria, dificultad, correcta, error_tag, tiempo_ms
            FROM math_portal.aprendizaje_respuestas
            WHERE alumno_id = ?
            ORDER BY respondida_en, id
            """, (rs, row) -> new Fila(rs.getString("origen"), rs.getString("categoria"), rs.getInt("dificultad"),
                rs.getBoolean("correcta"), rs.getString("error_tag"), rs.getLong("tiempo_ms")), alumno);
    }
}
