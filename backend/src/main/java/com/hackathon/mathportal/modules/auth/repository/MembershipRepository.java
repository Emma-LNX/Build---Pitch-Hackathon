package com.hackathon.mathportal.modules.auth.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.hackathon.mathportal.modules.auth.dto.SchoolRole;
import com.hackathon.mathportal.modules.courses.dto.CourseView;
import com.hackathon.mathportal.modules.schools.dto.SchoolView;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MembershipRepository {
    private final JdbcTemplate jdbc;
    public MembershipRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<SchoolView> schoolsFor(UUID userId) {
        return jdbc.query("""
            SELECT s.id, s.name, 'DIRECTOR' AS role FROM math_portal.schools s
            JOIN math_portal.school_directors d ON d.school_id = s.id WHERE d.user_id = ?
            UNION ALL
            SELECT s.id, s.name, m.role FROM math_portal.schools s
            JOIN math_portal.school_memberships m ON m.school_id = s.id
            WHERE m.user_id = ? AND NOT EXISTS (
                SELECT 1 FROM math_portal.school_directors d WHERE d.school_id = s.id AND d.user_id = ?)
            ORDER BY name, id
            """, (rs, row) -> new SchoolView(rs.getObject("id", UUID.class), rs.getString("name"),
                SchoolRole.valueOf(rs.getString("role"))), userId, userId, userId);
    }

    public boolean belongsToSchool(UUID userId, UUID schoolId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM math_portal.school_memberships WHERE school_id = ? AND user_id = ?)
                OR EXISTS(SELECT 1 FROM math_portal.school_directors WHERE school_id = ? AND user_id = ?)
            """, Boolean.class, schoolId, userId, schoolId, userId));
    }

    public List<CourseView> coursesFor(UUID userId, UUID schoolId) {
        return jdbc.query("""
            SELECT c.id, c.school_id, c.name FROM math_portal.courses c
            WHERE c.school_id = ? AND (
                EXISTS(SELECT 1 FROM math_portal.course_memberships m WHERE m.school_id = c.school_id AND m.course_id = c.id AND m.user_id = ?)
                OR EXISTS(SELECT 1 FROM math_portal.school_directors d WHERE d.school_id = c.school_id AND d.user_id = ?))
            ORDER BY c.name, c.id
            """, (rs, row) -> new CourseView(rs.getObject("id", UUID.class), rs.getObject("school_id", UUID.class), rs.getString("name")), schoolId, userId, userId);
    }

    public Optional<SchoolRole> courseRole(UUID userId, UUID schoolId, UUID courseId) {
        return jdbc.query("""
            SELECT 'DIRECTOR' AS role FROM math_portal.school_directors d
            JOIN math_portal.courses c ON c.school_id = d.school_id
            WHERE d.school_id = ? AND c.id = ? AND d.user_id = ?
            UNION ALL
            SELECT role FROM math_portal.course_memberships
            WHERE school_id = ? AND course_id = ? AND user_id = ?
            """, (rs, row) -> SchoolRole.valueOf(rs.getString("role")), schoolId, courseId, userId, schoolId, courseId, userId)
            .stream().findFirst();
    }
}
