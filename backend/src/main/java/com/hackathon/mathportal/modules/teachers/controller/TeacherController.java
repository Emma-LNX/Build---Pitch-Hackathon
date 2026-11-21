package com.hackathon.mathportal.modules.teachers.controller;

import com.hackathon.mathportal.modules.teachers.dto.TeacherDtos.*;
import com.hackathon.mathportal.modules.teachers.service.TeacherService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/schools/{school}")
public class TeacherController {
    private final TeacherService service;
    public TeacherController(TeacherService service) { this.service = service; }

    @GetMapping("/teachers/me")
    public Teacher me(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school) {
        return service.me(actor(jwt), school);
    }

    @GetMapping("/classrooms/{classroom}/statistics")
    public ClassroomStatistics classroomStatistics(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @PathVariable UUID classroom) {
        return service.classroomStatistics(actor(jwt), school, classroom);
    }

    @GetMapping("/classrooms/{classroom}/students/{student}/progress")
    public StudentProgress progress(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @PathVariable UUID classroom, @PathVariable UUID student) {
        return service.studentProgress(actor(jwt), school, classroom, student);
    }

    @PutMapping("/classrooms/{classroom}/students/{student}/difficult-topics/{topic}")
    public StudentProgress selectDifficult(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @PathVariable UUID classroom, @PathVariable UUID student, @PathVariable UUID topic) {
        return service.selectDifficult(actor(jwt), school, classroom, student, topic);
    }

    @DeleteMapping("/classrooms/{classroom}/students/{student}/difficult-topics/{topic}")
    public ResponseEntity<Void> clearDifficult(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @PathVariable UUID classroom, @PathVariable UUID student, @PathVariable UUID topic) {
        service.clearDifficult(actor(jwt), school, classroom, student, topic);
        return ResponseEntity.noContent().build();
    }

    private static UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
