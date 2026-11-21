package com.hackathon.mathportal.modules.exercises.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "actividades")
public class Activity {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "tema_id")
    private UUID topicId;

    @Column(name = "titulo")
    private String title;

    @Column(name = "tipo_juego")
    private String gameType;

    @Column(name = "orden")
    private int order;

    @Column(name = "activa")
    private boolean active;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTopicId() { return topicId; }
    public void setTopicId(UUID topicId) { this.topicId = topicId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getGameType() { return gameType; }
    public void setGameType(String gameType) { this.gameType = gameType; }

    public int getOrder() { return order; }
    public void setOrder(int order) { this.order = order; }

    public boolean getActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

}
