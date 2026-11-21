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
        Boolean rankingEnabled
    ) {}

    public record Profile(UUID id, String alias, String avatarKey, String schoolGrade,
        String timeZone, boolean rankingEnabled, String status, Instant createdAt, Instant updatedAt) {}
}
