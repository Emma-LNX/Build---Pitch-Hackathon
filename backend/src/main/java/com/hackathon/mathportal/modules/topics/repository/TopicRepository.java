package com.hackathon.mathportal.modules.topics.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.hackathon.mathportal.modules.topics.dto.CreateTopicRequest;
import com.hackathon.mathportal.modules.topics.dto.TopicView;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TopicRepository {
    private final JdbcTemplate jdbc;

    public TopicRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<TopicView> findForMember(UUID userId, UUID schoolId, UUID courseId) {
        return jdbc.query("""
            SELECT t.id, t.school_id, t.course_id, t.title, t.content, t.created_by
            FROM math_portal.topics t
            WHERE t.school_id = ? AND t.course_id = ? AND (
                EXISTS(SELECT 1 FROM math_portal.course_memberships m WHERE m.school_id = t.school_id AND m.course_id = t.course_id AND m.user_id = ?)
                OR EXISTS(SELECT 1 FROM math_portal.school_directors d WHERE d.school_id = t.school_id AND d.user_id = ?))
            ORDER BY t.created_at, t.id
            """, (rs, row) -> new TopicView(rs.getObject("id", UUID.class),
                rs.getObject("school_id", UUID.class), rs.getObject("course_id", UUID.class),
                rs.getString("title"), rs.getString("content"), rs.getObject("created_by", UUID.class)),
                schoolId, courseId, userId, userId);
    }

    public Optional<TopicView> createForTeacher(UUID userId, UUID schoolId, UUID courseId, CreateTopicRequest request) {
        UUID id = UUID.randomUUID();
        String title = request.title().strip();
        String content = request.content().strip();
        // Authorization is also part of the INSERT, not just a preceding service check.
        int inserted = jdbc.update("""
            INSERT INTO math_portal.topics (id, school_id, course_id, title, content, created_by)
            SELECT ?, school_id, course_id, ?, ?, user_id FROM math_portal.course_memberships
            WHERE school_id = ? AND course_id = ? AND user_id = ? AND role = 'PROFESOR'
            """, id, title, content, schoolId, courseId, userId);
        return inserted == 1
            ? Optional.of(new TopicView(id, schoolId, courseId, title, content, userId))
            : Optional.empty();
    }
}
