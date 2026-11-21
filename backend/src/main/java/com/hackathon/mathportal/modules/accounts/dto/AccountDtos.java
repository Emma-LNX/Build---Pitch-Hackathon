package com.hackathon.mathportal.modules.accounts.dto;

import java.time.Instant;
import java.util.UUID;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AccountDtos {
    private AccountDtos() {}

    /** Usuario: letras, números, punto, guion o guion bajo. Se compara sin distinguir mayúsculas. */
    public static final String USERNAME_PATTERN = "^[A-Za-z0-9._-]{3,30}$";

    // ---- Profesor ----
    public record TeacherClass(UUID schoolId, String schoolName, UUID courseId, String courseName) {}

    public record CreateStudent(
        @NotBlank @Size(max = 40) String displayName,
        @NotBlank @Pattern(regexp = USERNAME_PATTERN, message = "Usa de 3 a 30 letras, números, punto o guion") String username,
        @NotBlank @Size(min = 6, max = 72, message = "La contraseña debe tener entre 6 y 72 caracteres") String password) {}

    public record ResetPassword(
        @NotBlank @Size(min = 6, max = 72, message = "La contraseña debe tener entre 6 y 72 caracteres") String password) {}

    public record MoveStudent(@NotNull UUID courseId) {}

    /** Nunca incluye la contraseña: no se puede consultar después de entregarla. */
    public record StudentAccount(UUID userId, String displayName, String username, UUID courseId,
        Instant createdAt, Instant passwordResetAt) {}

    // ---- Acceso ----
    public record StudentLogin(@NotBlank @Size(max = 30) String username, @NotBlank @Size(max = 72) String password) {}

    public record StaffLogin(@NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 72) String password) {}

    public record RefreshRequest(@NotBlank @Size(max = 4096) String refreshToken) {}

    public record Session(String accessToken, String refreshToken, long expiresIn) {}

    // ---- Estudiante ----
    public record MyClass(UUID userId, String displayName, String username, UUID schoolId, String schoolName,
        UUID courseId, String courseName, String gender, UUID classroomId, String classroomName) {}
}
