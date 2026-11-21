package com.hackathon.mathportal.modules.parents.controller;

import com.hackathon.mathportal.modules.parents.dto.ParentDtos.*;
import com.hackathon.mathportal.modules.parents.service.ParentService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/schools/{school}/classrooms/{classroom}/students/{student}/parents")
public class ParentController {
    private final ParentService service;
    public ParentController(ParentService service) { this.service = service; }

    @GetMapping
    public List<ParentContact> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @PathVariable UUID classroom, @PathVariable UUID student) {
        return service.list(actor(jwt), school, classroom, student);
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ParentContact create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @PathVariable UUID classroom, @PathVariable UUID student, @Valid @RequestBody SaveParent request) {
        return service.create(actor(jwt), school, classroom, student, request);
    }

    @PutMapping("/{parent}")
    public ParentContact update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @PathVariable UUID classroom, @PathVariable UUID student, @PathVariable UUID parent,
            @Valid @RequestBody SaveParent request) {
        return service.update(actor(jwt), school, classroom, student, parent, request);
    }

    @DeleteMapping("/{parent}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @PathVariable UUID classroom, @PathVariable UUID student, @PathVariable UUID parent) {
        service.delete(actor(jwt), school, classroom, student, parent);
    }

    @PostMapping("/{parent}/reports")
    public ReportDelivery sendReport(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school,
            @PathVariable UUID classroom, @PathVariable UUID student, @PathVariable UUID parent) {
        return service.sendReport(actor(jwt), school, classroom, student, parent);
    }

    private static UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
