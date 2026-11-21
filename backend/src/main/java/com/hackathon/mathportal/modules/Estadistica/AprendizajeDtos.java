package com.hackathon.mathportal.modules.Estadistica;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AprendizajeDtos {
    private AprendizajeDtos() {}

    /** Mismo formato que `AnswerRecord` del frontend; los campos extra se ignoran. */
    public record Respuesta(
        @NotNull UUID id,
        @NotNull UUID sessionId,
        @NotBlank @Size(max = 20) String source,
        @NotBlank @Size(max = 30) String category,
        @NotBlank @Size(max = 40) String exercise,
        @Min(1) @Max(3) int difficulty,
        @NotBlank @Size(max = 20) String interaction,
        boolean correct,
        @Size(max = 40) String errorTag,
        @PositiveOrZero long timeMs,
        @NotNull Instant answeredAt) {}

    public record Lote(@NotNull @Size(max = 500) List<@Valid Respuesta> respuestas) {}

    public record Guardadas(int recibidas, int nuevas) {}

    public record Categoria(String categoria, int puntaje, String nivel, int respuestas, int correctas,
            long tiempoPromedioMs) {}

    public record ErrorFrecuente(String error, int veces) {}

    /** `recomendadas`: categorías más débiles, en orden; la app arma la misión con ellas. */
    public record Dominio(UUID alumnoId, List<Categoria> categorias, List<ErrorFrecuente> errores,
            List<String> recomendadas) {}
}
