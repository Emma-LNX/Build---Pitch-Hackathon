package com.hackathon.mathportal.modules.Estadistica;

import com.hackathon.mathportal.modules.Estadistica.AprendizajeDtos.Respuesta;
import java.sql.Timestamp;
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
