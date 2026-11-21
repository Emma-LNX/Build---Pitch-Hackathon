package com.hackathon.mathportal.modules.studentaccounts.dto;

import java.util.UUID;
import jakarta.validation.constraints.*;

public final class StudentAccountDtos {
    private StudentAccountDtos() {}

    // El usuario forma la parte local del correo interno; sin puntos al inicio, al final ni seguidos.
    public record CreateStudentAccount(
        @NotNull @Size(min = 3, max = 30)
        @Pattern(regexp = "[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)*", message = "Usa letras sin acentos, números, punto o guion bajo")
        String username,
        @NotNull @Size(min = 6, max = 72) String password,
        @NotBlank @Size(max = 40) String alias
    ) {}

    public record ChangePassword(@NotNull @Size(min = 6, max = 72) String password) {}

    public record StudentAccountView(UUID studentId, String username, String alias, UUID classroomId) {}
}
