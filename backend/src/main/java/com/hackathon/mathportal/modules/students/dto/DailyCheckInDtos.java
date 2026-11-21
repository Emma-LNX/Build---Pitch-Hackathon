package com.hackathon.mathportal.modules.students.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public final class DailyCheckInDtos {
    private DailyCheckInDtos() {}

    public enum Food { SUFICIENTE, POCO, NO_HE_COMIDO, PREFIERO_NO_RESPONDER }
    public enum Mood { FELIZ, TRANQUILO, TRISTE, PREOCUPADO, CANSADO, PREFIERO_NO_RESPONDER }

    public record Answers(
        // null = prefiere no responder. Nunca equivale a cero horas.
        @DecimalMin("0") @DecimalMax("24") @Digits(integer = 2, fraction = 1) BigDecimal sleepHours,
        @NotNull Food food,
        @NotNull Mood mood
    ) {}

    public record Entry(LocalDate date, BigDecimal sleepHours, Food food, Mood mood,
        String timeZone, Instant createdAt) {}
    public record OfflineAnswers(@NotNull LocalDate date, @NotNull @jakarta.validation.Valid Answers answers) {}
    public record Today(LocalDate date, boolean required, Entry checkIn) {}
}
