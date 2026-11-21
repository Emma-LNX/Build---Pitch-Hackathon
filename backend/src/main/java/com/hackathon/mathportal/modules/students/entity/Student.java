package com.hackathon.mathportal.modules.students.entity;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "alumnos")
public class Student {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "auth_subject")
    private String authSubject;

    @Column(name = "alias")
    private String alias;

    @Column(name = "avatar_clave")
    private String avatarKey;

    @Column(name = "grado_escolar")
    private String schoolGrade;

    @Column(name = "zona_horaria")
    private String timeZone;

    @Column(name = "participa_ranking")
    private boolean rankingEnabled;

    @Column(name = "estado")
    private String status;

    @Column(name = "genero")
    private String gender;

    @Column(name = "creado_en")
    private Instant createdAt;

    @Column(name = "actualizado_en")
    private Instant updatedAt;

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getAuthSubject() { return authSubject; }
    public void setAuthSubject(String authSubject) { this.authSubject = authSubject; }

    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }

    public String getAvatarKey() { return avatarKey; }
    public void setAvatarKey(String avatarKey) { this.avatarKey = avatarKey; }

    public String getSchoolGrade() { return schoolGrade; }
    public void setSchoolGrade(String schoolGrade) { this.schoolGrade = schoolGrade; }

    public String getTimeZone() { return timeZone; }
    public void setTimeZone(String timeZone) { this.timeZone = timeZone; }

    public boolean getRankingEnabled() { return rankingEnabled; }
    public void setRankingEnabled(boolean rankingEnabled) { this.rankingEnabled = rankingEnabled; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

}
