package com.hackathon.mathportal.modules.progress.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;
import java.time.LocalDate;

@Embeddable
public record LearningDayId(
    @Column(name = "alumno_id") UUID studentId,
    @Column(name = "fecha") LocalDate date
) implements Serializable {}
