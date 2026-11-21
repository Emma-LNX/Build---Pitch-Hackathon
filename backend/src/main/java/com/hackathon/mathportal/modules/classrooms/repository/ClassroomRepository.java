package com.hackathon.mathportal.modules.classrooms.repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.hackathon.mathportal.modules.classrooms.dto.ClassroomDtos.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ClassroomRepository {
    private final JdbcTemplate jdbc;
    public ClassroomRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String SELECT_CLASSROOM = """
        SELECT c.id, c.school_id, c.grade, c.section, c.academic_year, c.teacher_id, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM math_portal.classroom_students s
                WHERE s.school_id = c.school_id AND s.classroom_id = c.id) AS student_count
        FROM math_portal.classrooms c WHERE c.school_id = ?
        """;
    private static final String VISIBLE = """
        AND (c.teacher_id = ?
            OR EXISTS(SELECT 1 FROM math_portal.school_directors d WHERE d.school_id = c.school_id AND d.user_id = ?)
            OR EXISTS(SELECT 1 FROM math_portal.classroom_students s WHERE s.school_id = c.school_id AND s.classroom_id = c.id AND s.student_id = ?))
        """;
    private static final RowMapper<ClassroomView> MAPPER = (rs, row) -> new ClassroomView(
        rs.getObject("id", UUID.class), rs.getObject("school_id", UUID.class), rs.getString("grade"),
        rs.getString("section"), rs.getInt("academic_year"), rs.getObject("teacher_id", UUID.class),
        rs.getInt("student_count"), rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class));

    public List<ClassroomView> visibleFor(UUID actor, UUID school, Integer year) {
        var parameters = new ArrayList<Object>(List.of(school, actor, actor, actor));
        String sql = SELECT_CLASSROOM + VISIBLE;
        if (year != null) { sql += " AND c.academic_year = ?"; parameters.add(year); }
        return jdbc.query(sql + " ORDER BY c.academic_year DESC, c.grade, c.section, c.id", MAPPER, parameters.toArray());
    }

    public Optional<ClassroomView> visibleById(UUID actor, UUID school, UUID classroom) {
        return jdbc.query(SELECT_CLASSROOM + VISIBLE + " AND c.id = ?", MAPPER, school, actor, actor, actor, classroom).stream().findFirst();
    }

    public Optional<ClassroomView> findById(UUID school, UUID classroom) {
        return jdbc.query(SELECT_CLASSROOM + " AND c.id = ?", MAPPER, school, classroom).stream().findFirst();
    }

    public boolean hasRole(UUID school, UUID user, String role) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM math_portal.school_memberships WHERE school_id = ? AND user_id = ? AND role = ?)", Boolean.class, school, user, role));
    }

    public void create(UUID school, UUID classroom, String grade, String section, int year, UUID teacher) {
        jdbc.update("""
            INSERT INTO math_portal.classrooms (id, school_id, grade, section, academic_year, teacher_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """, classroom, school, grade, section, year, teacher);
    }

    public void update(UUID school, UUID classroom, String grade, String section, UUID teacher) {
        jdbc.update("""
            UPDATE math_portal.classrooms SET grade = ?, section = ?, teacher_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE school_id = ? AND id = ?
            """, grade, section, teacher, school, classroom);
    }

    public boolean deleteEmpty(UUID school, UUID classroom) {
        return jdbc.update("""
            DELETE FROM math_portal.classrooms c WHERE c.school_id = ? AND c.id = ?
                AND NOT EXISTS(SELECT 1 FROM math_portal.classroom_students s WHERE s.school_id = c.school_id AND s.classroom_id = c.id)
            """, school, classroom) == 1;
    }

    public Optional<UUID> classroomForStudent(UUID school, int year, UUID student) {
        return jdbc.query("SELECT classroom_id FROM math_portal.classroom_students WHERE school_id = ? AND academic_year = ? AND student_id = ?",
            (rs, row) -> rs.getObject(1, UUID.class), school, year, student).stream().findFirst();
    }

    public void enroll(UUID school, UUID classroom, int year, UUID student) {
        jdbc.update("INSERT INTO math_portal.classroom_students (school_id, classroom_id, academic_year, student_id) VALUES (?, ?, ?, ?)", school, classroom, year, student);
    }

    public boolean unenroll(UUID school, UUID classroom, UUID student) {
        return jdbc.update("DELETE FROM math_portal.classroom_students WHERE school_id = ? AND classroom_id = ? AND student_id = ?", school, classroom, student) == 1;
    }

    public boolean transfer(UUID school, UUID source, UUID target, UUID student) {
        return jdbc.update("""
            UPDATE math_portal.classroom_students SET classroom_id = ?
            WHERE school_id = ? AND classroom_id = ? AND student_id = ?
            """, target, school, source, student) == 1;
    }
    public List<StudentView> students(UUID school, UUID classroom) {
        return jdbc.query("""
            SELECT s.student_id, u.email, s.enrolled_at FROM math_portal.classroom_students s
            LEFT JOIN auth.users u ON u.id = s.student_id
            WHERE s.school_id = ? AND s.classroom_id = ? ORDER BY s.enrolled_at, s.student_id
            """, (rs, row) -> new StudentView(rs.getObject("student_id", UUID.class), rs.getString("email"), rs.getObject("enrolled_at", OffsetDateTime.class)), school, classroom);
    }
}
