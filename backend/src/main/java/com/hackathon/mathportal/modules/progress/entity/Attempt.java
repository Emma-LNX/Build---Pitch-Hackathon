package com.hackathon.mathportal.modules.progress.entity;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import com.fasterxml.jackson.databind.JsonNode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "partidas")
public class Attempt {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "alumno_id")
    private UUID studentId;

    @Column(name = "actividad_version_id")
    private UUID activityVersionId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "respuestas")
    private JsonNode answers;

    @Column(name = "puntaje_porcentaje", precision = 5, scale = 2)
    private BigDecimal scorePercentage;

    @Column(name = "aprobada")
    private boolean passed;

    @Column(name = "origen")
    private String origin;

    @Column(name = "finalizada_cliente_en")
    private Instant clientFinishedAt;

    @Column(name = "recibida_en")
    private Instant receivedAt;

    @Column(name = "fecha_aprendizaje")
    private LocalDate learningDate;

    @Column(name = "zona_horaria_aplicada")
    private String appliedTimeZone;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }

    public UUID getActivityVersionId() { return activityVersionId; }
    public void setActivityVersionId(UUID activityVersionId) { this.activityVersionId = activityVersionId; }

    public JsonNode getAnswers() { return answers; }
    public void setAnswers(JsonNode answers) { this.answers = answers; }

    public BigDecimal getScorePercentage() { return scorePercentage; }
    public void setScorePercentage(BigDecimal scorePercentage) { this.scorePercentage = scorePercentage; }

    public boolean getPassed() { return passed; }
    public void setPassed(boolean passed) { this.passed = passed; }

    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }

    public Instant getClientFinishedAt() { return clientFinishedAt; }
    public void setClientFinishedAt(Instant clientFinishedAt) { this.clientFinishedAt = clientFinishedAt; }

    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }

    public LocalDate getLearningDate() { return learningDate; }
    public void setLearningDate(LocalDate learningDate) { this.learningDate = learningDate; }

    public String getAppliedTimeZone() { return appliedTimeZone; }
    public void setAppliedTimeZone(String appliedTimeZone) { this.appliedTimeZone = appliedTimeZone; }

}
