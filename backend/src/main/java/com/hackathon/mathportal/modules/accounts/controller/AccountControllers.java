package com.hackathon.mathportal.modules.accounts.controller;

import java.util.List;
import java.util.UUID;
import com.hackathon.mathportal.modules.accounts.dto.AccountDtos.*;
import com.hackathon.mathportal.modules.accounts.service.AuthGateway;
import com.hackathon.mathportal.modules.accounts.service.SessionService;
import com.hackathon.mathportal.modules.accounts.service.StudentAccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** Contenedor de los controladores del módulo de cuentas. */
public final class AccountControllers {
    private AccountControllers() {}

    /** Acceso. Las rutas de inicio y renovación son públicas; el resto exige token. */
    @RestController
    @RequestMapping("/auth")
    public static class AuthController {
        private final SessionService sessions;
        public AuthController(SessionService sessions) { this.sessions = sessions; }

        @PostMapping("/student/login")
        public Session studentLogin(@Valid @RequestBody StudentLogin request) { return sessions.studentLogin(request); }

        @PostMapping("/staff/login")
        public Session staffLogin(@Valid @RequestBody StaffLogin request) { return sessions.staffLogin(request); }

        @PostMapping("/refresh")
        public Session refresh(@Valid @RequestBody RefreshRequest request) { return sessions.refresh(request); }

        @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
        public void logout(@AuthenticationPrincipal Jwt jwt) { sessions.logout(jwt.getTokenValue()); }
    }

    /** Gestión de cuentas por el profesor de la clase. */
    @RestController
    @RequestMapping("/teacher")
    public static class TeacherController {
        private final StudentAccountService accounts;
        public TeacherController(StudentAccountService accounts) { this.accounts = accounts; }

        @GetMapping("/classes")
        public List<TeacherClass> classes(@AuthenticationPrincipal Jwt jwt) { return accounts.classes(actor(jwt)); }

        @GetMapping("/classes/{courseId}/students")
        public List<StudentAccount> students(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID courseId) {
            return accounts.students(actor(jwt), courseId);
        }

        @PostMapping("/classes/{courseId}/students") @ResponseStatus(HttpStatus.CREATED)
        public StudentAccount create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID courseId,
                @Valid @RequestBody CreateStudent request) {
            return accounts.create(actor(jwt), courseId, request);
        }

        @PutMapping("/students/{userId}/password") @ResponseStatus(HttpStatus.NO_CONTENT)
        public void resetPassword(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID userId,
                @Valid @RequestBody ResetPassword request) {
            accounts.resetPassword(actor(jwt), userId, request);
        }

        @PutMapping("/students/{userId}/class") @ResponseStatus(HttpStatus.NO_CONTENT)
        public void move(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID userId, @Valid @RequestBody MoveStudent request) {
            accounts.move(actor(jwt), userId, request);
        }
    }

    /** La clase del estudiante autenticado. */
    @RestController
    public static class MyClassController {
        private final StudentAccountService accounts;
        public MyClassController(StudentAccountService accounts) { this.accounts = accounts; }

        @GetMapping("/students/me/class")
        public MyClass myClass(@AuthenticationPrincipal Jwt jwt) { return accounts.myClass(actor(jwt)); }
    }

    /** Errores del proveedor de identidad, sin filtrar detalles internos. */
    @RestControllerAdvice(assignableTypes = {AuthController.class, TeacherController.class, MyClassController.class})
    public static class AccountErrors {
        @ExceptionHandler(AuthGateway.AuthUnavailableException.class)
        @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
        ProblemDetail unavailable(AuthGateway.AuthUnavailableException ex) {
            return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "El servicio de cuentas no está disponible. Intenta de nuevo más tarde.");
        }
    }

    private static UUID actor(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
