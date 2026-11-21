package com.hackathon.mathportal.modules.parents.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class ParentDtos {
    private ParentDtos() {}

    public record SaveParent(
        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Size(max = 40) String relationship,
        @NotBlank @Email @Size(max = 254) String email,
        @Size(max = 30) String phone
    ) {}

    public record ParentContact(UUID id, UUID studentId, String fullName, String relationship,
        String email, String phone, Instant createdAt, Instant updatedAt, Instant lastReportSentAt) {}

    public record ReportDelivery(UUID parentId, Instant sentAt) {}
}
