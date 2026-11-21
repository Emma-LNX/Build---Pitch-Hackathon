package com.hackathon.mathportal.modules.students.repository;

import com.hackathon.mathportal.modules.students.dto.DailyCheckInDtos.*;
import java.time.LocalDate;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DailyCheckInRepository {
    private final JdbcTemplate jdbc;
    public DailyCheckInRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Optional<Entry> find(UUID studentId, LocalDate date) {
        return jdbc.query("""
            SELECT fecha, horas_sueno, alimentacion, estado_animo, zona_horaria, creado_en
            FROM math_portal.registros_diarios WHERE alumno_id = ? AND fecha = ?
            """, (rs, row) -> new Entry(rs.getObject("fecha", LocalDate.class),
                rs.getBigDecimal("horas_sueno"), Food.valueOf(rs.getString("alimentacion")),
                Mood.valueOf(rs.getString("estado_animo")), rs.getString("zona_horaria"),
                rs.getTimestamp("creado_en").toInstant()), studentId, date).stream().findFirst();
    }

    public void insert(UUID studentId, LocalDate date, String timeZone, Instant now, Answers answers) {
        jdbc.update("""
            INSERT INTO math_portal.registros_diarios
                (alumno_id, fecha, horas_sueno, alimentacion, estado_animo, zona_horaria, creado_en)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, studentId, date, answers.sleepHours(), answers.food().name(), answers.mood().name(),
            timeZone, java.sql.Timestamp.from(now));
    }
}
