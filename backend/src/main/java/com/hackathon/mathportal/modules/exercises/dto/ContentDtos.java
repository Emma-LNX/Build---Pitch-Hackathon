package com.hackathon.mathportal.modules.exercises.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;

public final class ContentDtos {
    private ContentDtos() {}

    public record TopicView(UUID id, String name, int order) {}
    public record ActivityView(UUID id, UUID topicId, String title, String gameType, int order) {}
    public record VersionView(UUID id, UUID activityId, int versionNumber, String difficulty,
        JsonNode content, int rewardXp, Instant publishedAt) {}
}
