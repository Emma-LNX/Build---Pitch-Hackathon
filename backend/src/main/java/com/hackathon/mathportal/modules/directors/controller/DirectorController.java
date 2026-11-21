package com.hackathon.mathportal.modules.directors.controller;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import com.hackathon.mathportal.modules.directors.dto.DirectorDtos.*;
import com.hackathon.mathportal.modules.directors.service.DirectorService;
import com.hackathon.mathportal.modules.schools.dto.SchoolView;
import com.hackathon.mathportal.modules.courses.dto.CourseView;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class DirectorController {
    private final DirectorService service;
    public DirectorController(DirectorService service) { this.service = service; }

    @PostMapping("/directors/register")
    public DirectorProfile register(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RegisterDirector request) {
        return service.register(actor(jwt), request);
    }
    @GetMapping("/directors/me")
    public DirectorProfile profile(@AuthenticationPrincipal Jwt jwt) { return service.profile(actor(jwt)); }

    @PostMapping("/schools") @ResponseStatus(HttpStatus.CREATED)
    public SchoolView createSchool(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NameRequest request) {
        return service.createSchool(actor(jwt), request);
    }
    @GetMapping("/schools/{school}/members")
    public List<Member> members(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school) {
        return service.members(actor(jwt), school);
    }
    @PostMapping("/schools/{school}/members") @ResponseStatus(HttpStatus.CREATED)
    public Member addMember(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @Valid @RequestBody AddMember request) {
        return service.addMember(actor(jwt), school, request);
    }
    @DeleteMapping("/schools/{school}/members/{user}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID user) {
        service.removeMember(actor(jwt), school, user);
    }
    @PostMapping("/schools/{school}/courses") @ResponseStatus(HttpStatus.CREATED)
    public CourseView createCourse(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @Valid @RequestBody NameRequest request) {
        return service.createCourse(actor(jwt), school, request);
    }
    @DeleteMapping("/schools/{school}/courses/{course}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeCourse(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID course) {
        service.removeCourse(actor(jwt), school, course);
    }
    @GetMapping("/schools/{school}/courses/{course}/members")
    public List<Member> courseMembers(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID course) {
        return service.courseMembers(actor(jwt), school, course);
    }
    @PutMapping("/schools/{school}/courses/{course}/members/{user}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void assignCourseMember(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID course, @PathVariable UUID user) {
        service.assignCourseMember(actor(jwt), school, course, user);
    }
    @DeleteMapping("/schools/{school}/courses/{course}/members/{user}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeCourseMember(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID course, @PathVariable UUID user) {
        service.removeCourseMember(actor(jwt), school, course, user);
    }
    @GetMapping("/schools/{school}/statistics")
    public Statistics statistics(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school) {
        return service.statistics(actor(jwt), school);
    }
    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
