package com.hackathon.mathportal.modules.teachers.repository;

import com.hackathon.mathportal.modules.teachers.dto.TeacherDtos.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TeacherRepository {
    private final JdbcTemplate jdbc;
    public TeacherRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public String teacherEmail(UUID school, UUID teacher) {
        return jdbc.query("""
            SELECT u.email FROM math_portal.school_memberships m
            LEFT JOIN auth.users u ON u.id = m.user_id
            WHERE m.school_id = ? AND m.user_id = ? AND m.role = 'PROFESOR'
            """, rs -> rs.next() ? rs.getString(1) : null, school, teacher);
    }

    public boolean enrolled(UUID school, UUID classroom, UUID student) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM math_portal.classroom_students
                WHERE school_id = ? AND classroom_id = ? AND student_id = ?)
            """, Boolean.class, school, classroom, student));
    }

    public String alias(UUID student) {
        return jdbc.query("SELECT alias FROM math_portal.alumnos WHERE auth_subject = ? AND estado = 'ACTIVO'",
            rs -> rs.next() ? rs.getString(1) : null, student.toString());
    }

    public int activeStudents(UUID school, UUID classroom) {
        return jdbc.queryForObject("""
            SELECT COUNT(DISTINCT cs.student_id) FROM math_portal.classroom_students cs
            JOIN math_portal.alumnos a ON a.auth_subject = CAST(cs.student_id AS varchar) AND a.estado = 'ACTIVO'
            JOIN math_portal.partidas p ON p.alumno_id = a.id
            WHERE cs.school_id = ? AND cs.classroom_id = ?
            """, Integer.class, school, classroom);
    }

    public RawStatistics studentStatistics(UUID student) {
        return jdbc.queryForObject("""
            SELECT COUNT(p.id) attempts,
                COUNT(CASE WHEN p.aprobada THEN 1 END) passed_attempts,
                AVG(p.puntaje_porcentaje) average_score,
                COUNT(DISTINCT CASE WHEN p.aprobada THEN av.actividad_id END) completed_activities
            FROM math_portal.alumnos a
            LEFT JOIN math_portal.partidas p ON p.alumno_id = a.id
            LEFT JOIN math_portal.actividad_versiones av ON av.id = p.actividad_version_id
            WHERE a.auth_subject = ? AND a.estado = 'ACTIVO'
            """, (rs, row) -> raw(rs), student.toString());
    }

    public RawStatistics classroomStatistics(UUID school, UUID classroom) {
        return jdbc.queryForObject("""
            SELECT COUNT(p.id) attempts,
                COUNT(CASE WHEN p.aprobada THEN 1 END) passed_attempts,
                AVG(p.puntaje_porcentaje) average_score,
                COUNT(DISTINCT CASE WHEN p.aprobada THEN av.actividad_id END) completed_activities
            FROM math_portal.classroom_students cs
            LEFT JOIN math_portal.alumnos a ON a.auth_subject = CAST(cs.student_id AS varchar) AND a.estado = 'ACTIVO'
            LEFT JOIN math_portal.partidas p ON p.alumno_id = a.id
            LEFT JOIN math_portal.actividad_versiones av ON av.id = p.actividad_version_id
            WHERE cs.school_id = ? AND cs.classroom_id = ?
            """, (rs, row) -> raw(rs), school, classroom);
    }

    public List<RawTopic> studentTopics(UUID school, UUID classroom, UUID student) {
        return jdbc.query("""
            SELECT t.id topic_id, t.nombre name, COUNT(p.id) attempts,
                COUNT(CASE WHEN p.aprobada THEN 1 END) passed_attempts,
                AVG(p.puntaje_porcentaje) average_score, MAX(p.recibida_en) last_attempt_at,
                EXISTS(SELECT 1 FROM math_portal.teacher_focus_topics f
                    WHERE f.school_id = ? AND f.classroom_id = ? AND f.student_id = ? AND f.topic_id = t.id) difficult
            FROM math_portal.partidas p
            JOIN math_portal.alumnos a ON a.id = p.alumno_id
            JOIN math_portal.actividad_versiones av ON av.id = p.actividad_version_id
            JOIN math_portal.actividades act ON act.id = av.actividad_id
            JOIN math_portal.temas t ON t.id = act.tema_id
            WHERE a.auth_subject = ? AND a.estado = 'ACTIVO'
            GROUP BY t.id, t.nombre
            ORDER BY t.nombre, t.id
            """, (rs, row) -> topic(rs), school, classroom, student, student.toString());
    }

    public List<RawTopic> classroomTopics(UUID school, UUID classroom) {
        return jdbc.query("""
            SELECT t.id topic_id, t.nombre name, COUNT(p.id) attempts,
                COUNT(CASE WHEN p.aprobada THEN 1 END) passed_attempts,
                AVG(p.puntaje_porcentaje) average_score, MAX(p.recibida_en) last_attempt_at,
                FALSE difficult
            FROM math_portal.classroom_students cs
            JOIN math_portal.alumnos a ON a.auth_subject = CAST(cs.student_id AS varchar) AND a.estado = 'ACTIVO'
            JOIN math_portal.partidas p ON p.alumno_id = a.id
            JOIN math_portal.actividad_versiones av ON av.id = p.actividad_version_id
            JOIN math_portal.actividades act ON act.id = av.actividad_id
            JOIN math_portal.temas t ON t.id = act.tema_id
            WHERE cs.school_id = ? AND cs.classroom_id = ?
            GROUP BY t.id, t.nombre
            ORDER BY t.nombre, t.id
            """, (rs, row) -> topic(rs), school, classroom);
    }

    public boolean selectDifficult(UUID school, UUID classroom, UUID student, UUID topic, UUID teacher) {
        return jdbc.update("""
            INSERT INTO math_portal.teacher_focus_topics
                (school_id, classroom_id, student_id, topic_id, selected_by)
            SELECT ?, ?, ?, t.id, ? FROM math_portal.temas t
            WHERE t.id = ? AND t.activo = TRUE
                AND EXISTS(SELECT 1 FROM math_portal.classroom_students cs
                    WHERE cs.school_id = ? AND cs.classroom_id = ? AND cs.student_id = ?)
                AND EXISTS(SELECT 1 FROM math_portal.partidas p
                    JOIN math_portal.alumnos a ON a.id = p.alumno_id
                    JOIN math_portal.actividad_versiones av ON av.id = p.actividad_version_id
                    JOIN math_portal.actividades act ON act.id = av.actividad_id
                    WHERE a.auth_subject = ? AND a.estado = 'ACTIVO' AND act.tema_id = t.id)
            """, school, classroom, student, teacher, topic, school, classroom, student, student.toString()) == 1;
    }

    public void lockClassroom(UUID school, UUID classroom) {
        jdbc.queryForObject("SELECT id FROM math_portal.classrooms WHERE school_id = ? AND id = ? FOR UPDATE",
            UUID.class, school, classroom);
    }

    public boolean isDifficult(UUID school, UUID classroom, UUID student, UUID topic) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM math_portal.teacher_focus_topics
                WHERE school_id = ? AND classroom_id = ? AND student_id = ? AND topic_id = ?)
            """, Boolean.class, school, classroom, student, topic));
    }

    public void clearDifficult(UUID school, UUID classroom, UUID student, UUID topic) {
        jdbc.update("""
            DELETE FROM math_portal.teacher_focus_topics
            WHERE school_id = ? AND classroom_id = ? AND student_id = ? AND topic_id = ?
            """, school, classroom, student, topic);
    }

    private static RawStatistics raw(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new RawStatistics(rs.getLong("attempts"), rs.getLong("passed_attempts"),
            rs.getBigDecimal("average_score"), rs.getLong("completed_activities"));
    }
    private static RawTopic topic(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new RawTopic(rs.getObject("topic_id", UUID.class), rs.getString("name"), rs.getLong("attempts"),
            rs.getLong("passed_attempts"), rs.getBigDecimal("average_score"),
            rs.getObject("last_attempt_at", OffsetDateTime.class), rs.getBoolean("difficult"));
    }
    public record RawStatistics(long attempts, long passedAttempts, BigDecimal averageScore, long completedActivities) {}
    public record RawTopic(UUID id, String name, long attempts, long passedAttempts, BigDecimal averageScore,
        OffsetDateTime lastAttemptAt, boolean difficult) {}
}
