package com.hackathon.mathportal.modules.topics.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "temas")
public class Topic {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "nombre")
    private String name;

    @Column(name = "orden")
    private int order;

    @Column(name = "activo")
    private boolean active;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getOrder() { return order; }
    public void setOrder(int order) { this.order = order; }

    public boolean getActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

}
