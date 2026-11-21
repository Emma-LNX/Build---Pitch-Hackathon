package com.hackathon.mathportal.modules.progress.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackathon.mathportal.common.TransactionLocks;
import com.hackathon.mathportal.modules.exercises.service.ContentService;
import com.hackathon.mathportal.modules.exercises.service.MultipleChoiceEvaluator;
import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.*;
import com.hackathon.mathportal.modules.progress.entity.*;
import com.hackathon.mathportal.modules.progress.repository.*;
import com.hackathon.mathportal.modules.students.service.StudentService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AttemptService {
    private final StudentService students;
    private final AttemptRepository attempts;
    private final ActivityProgressRepository progress;
    private final PointMovementRepository points;
    private final LearningDayRepository days;
    private final ContentService content;
    private final MultipleChoiceEvaluator evaluator;
    private final ProgressService summaries;
    private final AttemptMapper mapper;
    private final TransactionLocks locks;
    private final ObjectMapper json;
    private final Clock clock;

    public AttemptService(StudentService students, AttemptRepository attempts, ActivityProgressRepository progress,
            PointMovementRepository points, LearningDayRepository days, ContentService content,
            MultipleChoiceEvaluator evaluator, ProgressService summaries, AttemptMapper mapper,
            TransactionLocks locks, ObjectMapper json, Clock clock) {
        this.students = students;
        this.attempts = attempts;
        this.progress = progress;
        this.points = points;
        this.days = days;
        this.content = content;
        this.evaluator = evaluator;
        this.summaries = summaries;
        this.mapper = mapper;
        this.locks = locks;
        this.json = json;
        this.clock = clock;
    }

    @Transactional
    public AttemptResult submit(SubmitAttempt request) {
        // Lock the client UUID first, including across owners, then serialize writes for this student.
        locks.acquire("attempt:" + request.id());
        var student = students.lockCurrent();
        JsonNode answers = json.valueToTree(request.answers());
        Instant clientFinished = request.clientFinishedAt() == null ? null
            : request.clientFinishedAt().truncatedTo(ChronoUnit.MICROS);
        var existing = attempts.findById(request.id());
        if (existing.isPresent()) {
            var saved = existing.get();
            if (!saved.getStudentId().equals(student.getId())
                    || !saved.getActivityVersionId().equals(request.activityVersionId())
                    || !saved.getAnswers().equals(answers) || !saved.getOrigin().equals(request.origin().name())
                    || !Objects.equals(saved.getClientFinishedAt(), clientFinished)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "El UUID ya fue utilizado con otros datos");
            }
            return new AttemptResult(mapper.view(saved), summaries.summary(student));
        }

        var version = content.playableVersion(request.activityVersionId());
        var activity = content.activeActivity(version.getActivityId());
        if (!"OPCION_MULTIPLE".equals(activity.getGameType())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Tipo de juego no soportado");
        }
        var evaluation = evaluator.evaluate(version, request.answers());
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        LocalDate date = LocalDate.ofInstant(now, ZoneId.of(student.getTimeZone()));
        var attempt = new Attempt();
        attempt.setId(request.id());
        attempt.setStudentId(student.getId());
        attempt.setActivityVersionId(version.getId());
        attempt.setAnswers(answers);
        attempt.setScorePercentage(evaluation.score());
        attempt.setPassed(evaluation.passed());
        attempt.setOrigin(request.origin().name());
        attempt.setClientFinishedAt(clientFinished);
        attempt.setReceivedAt(now);
        attempt.setLearningDate(date);
        attempt.setAppliedTimeZone(student.getTimeZone());
        attempts.saveAndFlush(attempt);

        var progressId = new ActivityProgressId(student.getId(), activity.getId());
        var accumulated = progress.findById(progressId).orElseGet(() -> {
            var p = new ActivityProgress();
            p.setId(progressId);
            p.setBestScore(evaluation.score());
            return p;
        });
        boolean firstPass = evaluation.passed() && accumulated.getFirstPassedAt() == null;
        accumulated.setAttempts(accumulated.getAttempts() + 1);
        accumulated.setBestScore(accumulated.getBestScore().max(evaluation.score()));
        accumulated.setLastAttemptAt(now);
        if (firstPass) accumulated.setFirstPassedAt(now);
        progress.save(accumulated);

        if (firstPass && version.getRewardXp() > 0) {
            var movement = new PointMovement();
            movement.setId(UUID.randomUUID());
            movement.setStudentId(student.getId());
            movement.setActivityId(activity.getId());
            movement.setAttemptId(attempt.getId());
            movement.setAmount(version.getRewardXp());
            movement.setAwardedAt(now);
            points.save(movement);
        }
        var dayId = new LearningDayId(student.getId(), date);
        if (evaluation.passed() && !days.existsById(dayId)) {
            var day = new LearningDay();
            day.setId(dayId);
            day.setFirstAttemptId(attempt.getId());
            day.setCreatedAt(now);
            days.save(day);
        }
        // Flush all effects before constructing the response; they still share one transaction.
        attempts.flush();
        return new AttemptResult(mapper.view(attempt), summaries.summary(student));
    }
}
