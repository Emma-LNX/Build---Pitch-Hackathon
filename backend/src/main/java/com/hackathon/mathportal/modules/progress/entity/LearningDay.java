package com.hackathon.mathportal.modules.progress.entity;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "dias_aprendizaje")
public class LearningDay {
    @EmbeddedId
    private LearningDayId id;

    @Column(name = "primera_partida_id")
    private UUID firstAttemptId;

    @Column(name = "creado_en")
    private Instant createdAt;

    public LearningDayId getId() { return id; }
    public void setId(LearningDayId id) { this.id = id; }

    public UUID getFirstAttemptId() { return firstAttemptId; }
    public void setFirstAttemptId(UUID firstAttemptId) { this.firstAttemptId = firstAttemptId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

}
