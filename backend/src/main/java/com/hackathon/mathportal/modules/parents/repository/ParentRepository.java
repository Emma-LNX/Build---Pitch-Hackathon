package com.hackathon.mathportal.modules.parents.repository;

import com.hackathon.mathportal.modules.parents.dto.ParentDtos.ParentContact;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ParentRepository {
    private final JdbcTemplate jdbc;
    public ParentRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final RowMapper<ParentContact> MAPPER = (rs, row) -> new ParentContact(
        rs.getObject("id", UUID.class), rs.getObject("student_id", UUID.class), rs.getString("full_name"),
        rs.getString("relationship"), rs.getString("email"), rs.getString("phone"),
        rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
        rs.getTimestamp("last_report_sent_at") == null ? null : rs.getTimestamp("last_report_sent_at").toInstant());

    public List<ParentContact> list(UUID school, UUID classroom, UUID student) {
        return jdbc.query("""
            SELECT * FROM math_portal.parent_contacts
            WHERE school_id = ? AND classroom_id = ? AND student_id = ?
            ORDER BY full_name, id
            """, MAPPER, school, classroom, student);
    }

    public Optional<ParentContact> find(UUID school, UUID classroom, UUID student, UUID parent) {
        return jdbc.query("""
            SELECT * FROM math_portal.parent_contacts
            WHERE school_id = ? AND classroom_id = ? AND student_id = ? AND id = ?
            """, MAPPER, school, classroom, student, parent).stream().findFirst();
    }

    public void create(UUID id, UUID school, UUID classroom, UUID student, String name,
            String relationship, String email, String phone, UUID actor) {
        jdbc.update("""
            INSERT INTO math_portal.parent_contacts
                (id, school_id, classroom_id, student_id, full_name, relationship, email, phone, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, id, school, classroom, student, name, relationship, email, phone, actor);
    }

    public boolean update(UUID school, UUID classroom, UUID student, UUID parent, String name,
            String relationship, String email, String phone) {
        return jdbc.update("""
            UPDATE math_portal.parent_contacts
            SET full_name = ?, relationship = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
            WHERE school_id = ? AND classroom_id = ? AND student_id = ? AND id = ?
            """, name, relationship, email, phone, school, classroom, student, parent) == 1;
    }

    public boolean delete(UUID school, UUID classroom, UUID student, UUID parent) {
        return jdbc.update("""
            DELETE FROM math_portal.parent_contacts
            WHERE school_id = ? AND classroom_id = ? AND student_id = ? AND id = ?
            """, school, classroom, student, parent) == 1;
    }

    public void markSent(UUID school, UUID classroom, UUID student, UUID parent, Instant sentAt) {
        jdbc.update("""
            UPDATE math_portal.parent_contacts SET last_report_sent_at = ?
            WHERE school_id = ? AND classroom_id = ? AND student_id = ? AND id = ?
            """, Timestamp.from(sentAt), school, classroom, student, parent);
    }

    public List<WeeklyTarget> dueForWeekly(Instant weekStart) {
        return jdbc.query("""
            SELECT p.id, p.school_id, p.classroom_id, p.student_id, c.teacher_id
            FROM math_portal.parent_contacts p
            JOIN math_portal.classrooms c ON c.school_id = p.school_id AND c.id = p.classroom_id
            JOIN math_portal.school_memberships m
                ON m.school_id = c.school_id AND m.user_id = c.teacher_id AND m.role = 'PROFESOR'
            WHERE p.created_at < ?
                AND (p.last_report_sent_at IS NULL OR p.last_report_sent_at < ?)
            ORDER BY p.id
            """, (rs, row) -> new WeeklyTarget(rs.getObject("id", UUID.class),
                rs.getObject("school_id", UUID.class), rs.getObject("classroom_id", UUID.class),
                rs.getObject("student_id", UUID.class), rs.getObject("teacher_id", UUID.class)),
            Timestamp.from(weekStart), Timestamp.from(weekStart));
    }

    public boolean claimWeekly(UUID parent, Instant weekStart, Instant claimedAt, Instant expiredBefore) {
        return jdbc.update("""
            UPDATE math_portal.parent_contacts SET weekly_claimed_at = ?
            WHERE id = ?
                AND (last_report_sent_at IS NULL OR last_report_sent_at < ?)
                AND (weekly_claimed_at IS NULL OR weekly_claimed_at < ?)
            """, Timestamp.from(claimedAt), parent, Timestamp.from(weekStart), Timestamp.from(expiredBefore)) == 1;
    }

    public void releaseWeekly(UUID parent, Instant claimedAt) {
        jdbc.update("""
            UPDATE math_portal.parent_contacts SET weekly_claimed_at = NULL
            WHERE id = ? AND weekly_claimed_at = ?
            """, parent, Timestamp.from(claimedAt));
    }

    public record WeeklyTarget(UUID parentId, UUID schoolId, UUID classroomId, UUID studentId, UUID teacherId) {}
}
