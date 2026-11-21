package com.hackathon.mathportal.modules.exercises.controller;

import com.hackathon.mathportal.modules.exercises.dto.ContentDtos.*;
import com.hackathon.mathportal.modules.exercises.service.ContentService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
public class ContentController {
    private final ContentService content;

    public ContentController(ContentService content) { this.content = content; }

    @GetMapping("/topics")
    public List<TopicView> topics() { return content.topics(); }

    @GetMapping("/topics/{topicId}/activities")
    public List<ActivityView> activities(@PathVariable UUID topicId) { return content.activities(topicId); }

    @GetMapping("/activities/{activityId}/versions/latest")
    public VersionView latest(@PathVariable UUID activityId) { return content.latest(activityId); }

    @GetMapping("/activity-versions/{versionId}")
    public VersionView version(@PathVariable UUID versionId) { return content.version(versionId); }
}
