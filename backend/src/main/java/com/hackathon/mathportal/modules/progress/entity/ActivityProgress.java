package com.hackathon.mathportal.modules.progress.entity;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;
import java.math.BigDecimal;

@Entity
@Table(name = "progreso_actividades")
public class ActivityProgress {
    @EmbeddedId
    private ActivityProgressId id;

    @Column(name = "intentos")
    private int attempts;

    @Column(name = "mejor_puntaje", precision = 5, scale = 2)
    private BigDecimal bestScore;

    @Column(name = "primera_aprobacion_en")
    private Instant firstPassedAt;

    @Column(name = "ultima_partida_en")
    private Instant lastAttemptAt;

    public ActivityProgressId getId() { return id; }
    public void setId(ActivityProgressId id) { this.id = id; }

    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }

    public BigDecimal getBestScore() { return bestScore; }
    public void setBestScore(BigDecimal bestScore) { this.bestScore = bestScore; }

    public Instant getFirstPassedAt() { return firstPassedAt; }
    public void setFirstPassedAt(Instant firstPassedAt) { this.firstPassedAt = firstPassedAt; }

    public Instant getLastAttemptAt() { return lastAttemptAt; }
    public void setLastAttemptAt(Instant lastAttemptAt) { this.lastAttemptAt = lastAttemptAt; }

}

