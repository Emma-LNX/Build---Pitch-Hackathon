package com.hackathon.mathportal.modules.directors.dto;

import java.util.UUID;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.hackathon.mathportal.modules.auth.dto.SchoolRole;

public final class DirectorDtos {
    private DirectorDtos() {}
    public record RegisterDirector(@NotBlank @Size(max = 100) String name) {}
    public record DirectorProfile(UUID userId, String name, String email) {}
    public record NameRequest(@NotBlank @Size(max = 160) String name) {}
    public record AddMember(@NotBlank @Email @Size(max = 254) String email, @NotNull SchoolRole role) {}
    public record Member(UUID userId, String email, SchoolRole role) {}
    public record Statistics(int professors, int students, int courses, int topics, int classrooms) {}
}
