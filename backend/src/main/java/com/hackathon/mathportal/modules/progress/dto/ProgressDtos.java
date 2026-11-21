package com.hackathon.mathportal.modules.progress.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ProgressDtos {
    private ProgressDtos() {}

    public enum Origin { ONLINE, OFFLINE }

    public record SubmitAttempt(
        @NotNull UUID id,
        @NotNull UUID activityVersionId,
        @NotEmpty @Size(max = 100)
        Map<@NotBlank @Size(max = 80) String, @NotBlank @Size(max = 80) String> answers,
        @NotNull Origin origin,
        Instant clientFinishedAt
    ) {}

    public record LevelView(UUID id, int number, String name, long minimumXp) {}
    public record Streak(int current, int longest) {}
    public record TopicProgress(UUID topicId, String name, long completed, long total) {}
    public record Summary(long totalXp, LevelView level, LevelView nextLevel, Long xpToNextLevel,
        Streak streak, List<TopicProgress> topics) {}
    public record ActivityProgressView(UUID activityId, String status, int attempts,
        BigDecimal bestScore, Instant firstPassedAt, Instant lastAttemptAt) {}
    public record AttemptView(UUID id, UUID activityVersionId, Map<String, String> answers,
        BigDecimal scorePercentage, boolean passed, Origin origin, Instant clientFinishedAt,
        Instant receivedAt, LocalDate learningDate, String appliedTimeZone, int awardedXp) {}
    public record AttemptResult(AttemptView attempt, Summary progress) {}
    public record RankingEntry(String alias, LevelView level, long totalXp, long position) {}
}
