package com.hackathon.mathportal.modules.teachers.dto;

import com.hackathon.mathportal.modules.classrooms.dto.ClassroomDtos.ClassroomView;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class TeacherDtos {
    private TeacherDtos() {}

    public record Teacher(UUID userId, UUID schoolId, String email, List<ClassroomView> classrooms) {}
    public record Statistics(long attempts, long passedAttempts, double passPercentage,
        BigDecimal averageScore, long completedActivities) {}
    public record TopicStatistics(UUID topicId, String name, long attempts, long passedAttempts,
        double passPercentage, BigDecimal averageScore, OffsetDateTime lastAttemptAt, boolean difficult) {}
    public record StudentProgress(UUID studentId, String alias, Statistics statistics,
        List<TopicStatistics> topics) {}
    public record ClassroomStatistics(UUID classroomId, int students, int activeStudents,
        Statistics statistics, List<TopicStatistics> topics) {}
}
