package com.hackathon.mathportal.modules.progress.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record ActivityProgressId(
    @Column(name = "alumno_id") UUID studentId,
    @Column(name = "actividad_id") UUID activityId
) implements Serializable {}
