package com.hackathon.mathportal.modules.exercises.entity;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;
import com.fasterxml.jackson.databind.JsonNode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "actividad_versiones")
public class ActivityVersion {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "actividad_id")
    private UUID activityId;

    @Column(name = "numero_version")
    private int versionNumber;

    @Column(name = "dificultad")
    private String difficulty;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "contenido")
    private JsonNode content;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "reglas_evaluacion")
    private JsonNode evaluationRules;

    @Column(name = "xp_recompensa")
    private int rewardXp;

    @Column(name = "publicada_en")
    private Instant publishedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getActivityId() { return activityId; }
    public void setActivityId(UUID activityId) { this.activityId = activityId; }

    public int getVersionNumber() { return versionNumber; }
    public void setVersionNumber(int versionNumber) { this.versionNumber = versionNumber; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public JsonNode getContent() { return content; }
    public void setContent(JsonNode content) { this.content = content; }

    public JsonNode getEvaluationRules() { return evaluationRules; }
    public void setEvaluationRules(JsonNode evaluationRules) { this.evaluationRules = evaluationRules; }

    public int getRewardXp() { return rewardXp; }
    public void setRewardXp(int rewardXp) { this.rewardXp = rewardXp; }

    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }

}
