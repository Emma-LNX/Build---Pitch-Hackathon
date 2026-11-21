package com.hackathon.mathportal.modules.studentaccounts.controller;

import java.util.UUID;
import jakarta.validation.Valid;
import com.hackathon.mathportal.modules.studentaccounts.dto.StudentAccountDtos.*;
import com.hackathon.mathportal.modules.studentaccounts.service.StudentAccountService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/schools/{school}/classrooms/{classroom}/student-accounts")
public class StudentAccountController {
    private final StudentAccountService service;
    public StudentAccountController(StudentAccountService service) { this.service = service; }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public StudentAccountView create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID classroom,
            @Valid @RequestBody CreateStudentAccount request) {
        return service.create(actor(jwt), school, classroom, request);
    }
    @PutMapping("/{student}/password") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID school, @PathVariable UUID classroom,
            @PathVariable UUID student, @Valid @RequestBody ChangePassword request) {
        service.changePassword(actor(jwt), school, classroom, student, request);
    }
    private UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
