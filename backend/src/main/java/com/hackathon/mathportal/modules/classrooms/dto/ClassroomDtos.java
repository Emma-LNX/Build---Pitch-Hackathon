package com.hackathon.mathportal.modules.classrooms.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.validation.constraints.*;

public final class ClassroomDtos {
    private ClassroomDtos() {}

    public record CreateClassroom(
        @NotBlank @Size(max = 80) String grade,
        @NotBlank @Size(max = 16) String section,
        @NotNull @Min(1) @Max(9999) Integer academicYear,
        @NotNull UUID teacherId
    ) {}

    // The academic year is immutable, preserving enrollment history and uniqueness.
    public record UpdateClassroom(
        @NotBlank @Size(max = 80) String grade,
        @NotBlank @Size(max = 16) String section,
        @NotNull UUID teacherId
    ) {}

    public record ClassroomView(UUID id, UUID schoolId, String grade, String section,
        int academicYear, UUID teacherId, int studentCount, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

    public record TransferStudent(@NotNull UUID targetClassroomId) {}

    public record StudentView(UUID userId, String email, OffsetDateTime enrolledAt) {}
}
