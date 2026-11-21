package com.hackathon.mathportal.modules.classrooms.controller;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import com.hackathon.mathportal.modules.classrooms.dto.ClassroomDtos.*;
import com.hackathon.mathportal.modules.classrooms.service.ClassroomService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/schools/{school}/classrooms")
public class ClassroomController {
    private final ClassroomService service;
    public ClassroomController(ClassroomService service) { this.service = service; }

    @GetMapping
    public List<ClassroomView> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @RequestParam(required = false) Integer academicYear) {
        return service.list(actor(jwt), school, academicYear);
    }
    @GetMapping("/{classroom}")
    public ClassroomView get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID classroom) {
        return service.get(actor(jwt), school, classroom);
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ClassroomView create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @Valid @RequestBody CreateClassroom request) {
        return service.create(actor(jwt), school, request);
    }
    @PutMapping("/{classroom}")
    public ClassroomView update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID classroom,
            @Valid @RequestBody UpdateClassroom request) {
        return service.update(actor(jwt), school, classroom, request);
    }
    @DeleteMapping("/{classroom}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID classroom) {
        service.delete(actor(jwt), school, classroom);
    }
    @GetMapping("/{classroom}/students")
    public List<StudentView> students(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID classroom) {
        return service.students(actor(jwt), school, classroom);
    }
    @PutMapping("/{classroom}/students/{student}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void enroll(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID classroom, @PathVariable UUID student) {
        service.enroll(actor(jwt), school, classroom, student);
    }
    @DeleteMapping("/{classroom}/students/{student}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unenroll(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID classroom, @PathVariable UUID student) {
        service.unenroll(actor(jwt), school, classroom, student);
    }
    @PostMapping("/{classroom}/students/{student}/transfer") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void transfer(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID classroom,
            @PathVariable UUID student, @Valid @RequestBody TransferStudent request) {
        service.transfer(actor(jwt), school, classroom, student, request);
    }
    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
