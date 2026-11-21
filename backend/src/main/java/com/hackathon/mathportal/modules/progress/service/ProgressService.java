package com.hackathon.mathportal.modules.progress.service;

import com.hackathon.mathportal.common.PageResponse;
import com.hackathon.mathportal.modules.exercises.repository.ActivityRepository;
import com.hackathon.mathportal.modules.exercises.service.ContentService;
import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.*;
import com.hackathon.mathportal.modules.progress.entity.*;
import com.hackathon.mathportal.modules.progress.repository.*;
import com.hackathon.mathportal.modules.students.entity.Student;
import com.hackathon.mathportal.modules.students.service.StudentService;
import com.hackathon.mathportal.modules.topics.repository.TopicRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProgressService {
    private final StudentService students;
    private final PointMovementRepository points;
    private final LevelRepository levels;
    private final LearningDayRepository days;
    private final ActivityProgressRepository progress;
    private final TopicRepository topics;
    private final ActivityRepository activities;
    private final AttemptRepository attempts;
    private final ContentService content;
    private final AttemptMapper mapper;
    private final Clock clock;

    public ProgressService(StudentService students, PointMovementRepository points, LevelRepository levels,
            LearningDayRepository days, ActivityProgressRepository progress, TopicRepository topics,
            ActivityRepository activities, AttemptRepository attempts, ContentService content,
            AttemptMapper mapper, Clock clock) {
        this.students = students;
        this.points = points;
        this.levels = levels;
        this.days = days;
        this.progress = progress;
        this.topics = topics;
        this.activities = activities;
        this.attempts = attempts;
        this.content = content;
        this.mapper = mapper;
        this.clock = clock;
    }

    public List<LevelView> levels() {
        return levels.findAllByOrderByMinimumXpAsc().stream().map(ProgressService::levelView).toList();
    }

    public Summary mine() { return summary(students.current()); }

    public Summary summary(Student student) {
        long xp = points.totalXp(student.getId());
        List<LevelView> catalog = levels();
        var level = catalog.stream().filter(l -> l.minimumXp() <= xp)
            .reduce((first, second) -> second).orElseThrow(() -> new IllegalStateException("Falta el nivel inicial"));
        var next = catalog.stream().filter(l -> l.minimumXp() > xp).findFirst().orElse(null);
        var dates = days.findByIdStudentIdOrderByIdDateAsc(student.getId()).stream().map(d -> d.getId().date()).toList();
        var streak = StreakCalculator.calculate(dates, LocalDate.ofInstant(clock.instant(), ZoneId.of(student.getTimeZone())));
        Map<UUID, ActivityProgress> progressByActivity = progress.findByIdStudentId(student.getId()).stream()
            .collect(Collectors.toMap(p -> p.getId().activityId(), Function.identity()));
        var activeActivities = activities.findByActiveTrue();
        var topicProgress = topics.findByActiveTrueOrderByOrderAscIdAsc().stream().map(t -> {
            var topicActivities = activeActivities.stream().filter(a -> a.getTopicId().equals(t.getId())).toList();
            long completed = topicActivities.stream().filter(a -> {
                var p = progressByActivity.get(a.getId());
                return p != null && p.getFirstPassedAt() != null;
            }).count();
            return new TopicProgress(t.getId(), t.getName(), completed, topicActivities.size());
        }).toList();
        return new Summary(xp, level, next, next == null ? null : next.minimumXp() - xp, streak, topicProgress);
    }

    public ActivityProgressView activity(UUID activityId) {
        var student = students.current();
        content.activeActivity(activityId);
        return progress.findById(new ActivityProgressId(student.getId(), activityId))
            .map(p -> new ActivityProgressView(activityId,
                p.getFirstPassedAt() == null ? "EN_PROGRESO" : "COMPLETADA", p.getAttempts(),
                p.getBestScore(), p.getFirstPassedAt(), p.getLastAttemptAt()))
            .orElseGet(() -> new ActivityProgressView(activityId, "NO_INICIADA", 0, BigDecimal.ZERO, null, null));
    }

    public PageResponse<AttemptView> history(int page, int size) {
        var pageable = PageResponse.request(page, size)
            .withSort(Sort.by(Sort.Order.desc("receivedAt"), Sort.Order.asc("id")));
        var student = students.current();
        return PageResponse.from(attempts.findByStudentId(student.getId(), pageable).map(mapper::view));
    }

    public static LevelView levelView(Level level) {
        return new LevelView(level.getId(), level.getNumber(), level.getName(), level.getMinimumXp());
    }
}
