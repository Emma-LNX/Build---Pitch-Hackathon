package com.hackathon.mathportal.modules.schools.controller;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import com.hackathon.mathportal.modules.courses.dto.CourseView;
import com.hackathon.mathportal.modules.schools.dto.SchoolView;
import com.hackathon.mathportal.modules.schools.service.SchoolPortalService;
import com.hackathon.mathportal.modules.topics.dto.CreateTopicRequest;
import com.hackathon.mathportal.modules.topics.dto.TopicView;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/schools")
public class SchoolPortalController {
    private final SchoolPortalService service;

    public SchoolPortalController(SchoolPortalService service) { this.service = service; }

    @GetMapping
    public List<SchoolView> schools(@AuthenticationPrincipal Jwt jwt) {
        return service.schools(userId(jwt));
    }

    @GetMapping("/{schoolId}/courses")
    public List<CourseView> courses(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID schoolId) {
        return service.courses(userId(jwt), schoolId);
    }

    @GetMapping("/{schoolId}/courses/{courseId}/topics")
    public List<TopicView> topics(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID schoolId, @PathVariable UUID courseId) {
        return service.topics(userId(jwt), schoolId, courseId);
    }

    @PostMapping("/{schoolId}/courses/{courseId}/topics")
    public ResponseEntity<TopicView> createTopic(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID schoolId, @PathVariable UUID courseId,
            @Valid @RequestBody CreateTopicRequest request) {
        TopicView topic = service.createTopic(userId(jwt), schoolId, courseId, request);
        return ResponseEntity.created(URI.create("/api/schools/" + schoolId + "/courses/" + courseId + "/topics"))
            .body(topic);
    }

    private UUID userId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
