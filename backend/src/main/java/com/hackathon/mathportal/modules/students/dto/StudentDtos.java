package com.hackathon.mathportal.modules.students.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

public final class StudentDtos {
    private StudentDtos() {}

    public record Create(
        @NotBlank @Size(max = 40) String alias,
        @Size(max = 100) String avatarKey,
        @Size(max = 30) String schoolGrade,
        @Size(max = 100) String timeZone,
        Boolean rankingEnabled
    ) {}

    // null means unchanged. Empty avatarKey/schoolGrade explicitly clears that optional field.
    public record Patch(
        @Size(max = 40) @Pattern(regexp = "(?s).*\\S.*") String alias,
        @Size(max = 100) String avatarKey,
        @Size(max = 30) String schoolGrade,
        @Size(max = 100) String timeZone,
        Boolean rankingEnabled,
        // Género del avatar elegido por el estudiante. No interviene en el acceso.
        @Pattern(regexp = "NINA|NINO", message = "Usa NINA o NINO") String gender
    ) {}

    public record Profile(UUID id, String alias, String avatarKey, String schoolGrade,
        String timeZone, boolean rankingEnabled, String status, Instant createdAt, Instant updatedAt, String gender) {}
}
