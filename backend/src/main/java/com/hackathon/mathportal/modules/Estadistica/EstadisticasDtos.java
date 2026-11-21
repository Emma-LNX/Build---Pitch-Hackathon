package com.hackathon.mathportal.modules.Estadistica;

import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.Streak;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class EstadisticasDtos {
    private EstadisticasDtos() {}

    public record Alumno(UUID id, String alias, String zonaHoraria) {}
    public record Resumen(Alumno alumno, Map<String, Object> progresoNivel, Streak rachaPractica,
            Map<String, Object> totales, List<Map<String, Object>> aciertosPorTema,
            List<Map<String, Object>> tiemposPorDesafio) {}
    public record RegistrarTiempo(@NotNull Instant iniciadaEn, @NotNull Instant finalizadaEn,
            @NotNull @PositiveOrZero Long tiempoActivoMs) {}
    public record Tiempo(UUID partidaId, Instant iniciadaEn, Instant finalizadaEn,
            long tiempoTranscurridoMs, long tiempoActivoMs, String fuente) {}
}