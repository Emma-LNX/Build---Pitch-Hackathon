package com.hackathon.mathportal.modules.progress.entity;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "movimientos_puntos")
public class PointMovement {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "alumno_id")
    private UUID studentId;

    @Column(name = "actividad_id")
    private UUID activityId;

    @Column(name = "partida_id")
    private UUID attemptId;

    @Column(name = "cantidad")
    private int amount;

    @Column(name = "otorgado_en")
    private Instant awardedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }

    public UUID getActivityId() { return activityId; }
    public void setActivityId(UUID activityId) { this.activityId = activityId; }

    public UUID getAttemptId() { return attemptId; }
    public void setAttemptId(UUID attemptId) { this.attemptId = attemptId; }

    public int getAmount() { return amount; }
    public void setAmount(int amount) { this.amount = amount; }

    public Instant getAwardedAt() { return awardedAt; }
    public void setAwardedAt(Instant awardedAt) { this.awardedAt = awardedAt; }

}
