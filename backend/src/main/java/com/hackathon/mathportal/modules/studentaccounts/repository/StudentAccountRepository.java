package com.hackathon.mathportal.modules.studentaccounts.repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class StudentAccountRepository {
    private final JdbcTemplate jdbc;
    public StudentAccountRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void lockClassroom(UUID school, UUID classroom) {
        jdbc.query("SELECT id FROM math_portal.classrooms WHERE school_id = ? AND id = ? FOR UPDATE",
            (rs, row) -> rs.getObject(1, UUID.class), school, classroom);
    }

    public void addStudentMembership(UUID school, UUID user) {
        jdbc.update("INSERT INTO math_portal.school_memberships (school_id, user_id, role) VALUES (?, ?, 'ALUMNO')", school, user);
    }

    public void createProfile(UUID id, String authSubject, String alias, String grade, String timeZone, Instant now) {
        var timestamp = OffsetDateTime.ofInstant(now, ZoneOffset.UTC);
        jdbc.update("""
            INSERT INTO math_portal.alumnos (id, auth_subject, alias, grado_escolar, zona_horaria, participa_ranking, estado, creado_en, actualizado_en)
            VALUES (?, ?, ?, ?, ?, false, 'ACTIVO', ?, ?)
            """, id, authSubject, alias, grade, timeZone, timestamp, timestamp);
    }

    public boolean enrolled(UUID school, UUID classroom, UUID student) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM math_portal.classroom_students WHERE school_id = ? AND classroom_id = ? AND student_id = ?)
            """, Boolean.class, school, classroom, student));
    }

    public Optional<String> accountEmail(UUID user) {
        return jdbc.query("SELECT email FROM auth.users WHERE id = ? AND email IS NOT NULL", (rs, row) -> rs.getString("email"), user)
            .stream().findFirst();
    }
}
