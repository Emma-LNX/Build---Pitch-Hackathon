package com.hackathon.mathportal.modules.exercises.service;

import com.hackathon.mathportal.modules.exercises.dto.ContentDtos.*;
import com.hackathon.mathportal.modules.exercises.entity.*;
import com.hackathon.mathportal.modules.exercises.repository.*;
import com.hackathon.mathportal.modules.topics.repository.TopicRepository;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ContentService {
    private final TopicRepository topics;
    private final ActivityRepository activities;
    private final ActivityVersionRepository versions;
    private final Clock clock;

    public ContentService(TopicRepository topics, ActivityRepository activities,
            ActivityVersionRepository versions, Clock clock) {
        this.topics = topics;
        this.activities = activities;
        this.versions = versions;
        this.clock = clock;
    }

    public List<TopicView> topics() {
        return topics.findByActiveTrueOrderByOrderAscIdAsc().stream()
            .map(t -> new TopicView(t.getId(), t.getName(), t.getOrder())).toList();
    }

    public List<ActivityView> activities(UUID topicId) {
        if (!topics.findById(topicId).map(t -> t.getActive()).orElse(false)) throw notFound();
        return activities.findByTopicIdAndActiveTrueOrderByOrderAscIdAsc(topicId).stream()
            .map(a -> new ActivityView(a.getId(), a.getTopicId(), a.getTitle(), a.getGameType(), a.getOrder())).toList();
    }

    public VersionView latest(UUID activityId) {
        activeActivity(activityId);
        return view(versions.findFirstByActivityIdAndPublishedAtLessThanEqualOrderByVersionNumberDesc(
            activityId, clock.instant()).orElseThrow(ContentService::notFound));
    }

    public VersionView version(UUID versionId) { return view(playableVersion(versionId)); }

    public Activity activeActivity(UUID id) {
        var activity = activities.findById(id).orElseThrow(ContentService::notFound);
        if (!activity.getActive() || !topics.findById(activity.getTopicId()).map(t -> t.getActive()).orElse(false)) {
            throw notFound();
        }
        return activity;
    }

    public ActivityVersion playableVersion(UUID versionId) {
        var version = versions.findById(versionId).orElseThrow(ContentService::notFound);
        if (version.getPublishedAt().isAfter(clock.instant())) throw notFound();
        activeActivity(version.getActivityId());
        return version;
    }

    private VersionView view(ActivityVersion version) {
        // Explicit DTO: evaluationRules (including correct answers) never leave the backend.
        return new VersionView(version.getId(), version.getActivityId(), version.getVersionNumber(),
            version.getDifficulty(), version.getContent(), version.getRewardXp(), version.getPublishedAt());
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "El contenido no está disponible");
    }
}
