package com.hackathon.mathportal.modules.progress.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "niveles_alumno")
public class Level {
    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "numero")
    private int number;

    @Column(name = "nombre")
    private String name;

    @Column(name = "xp_minimos")
    private long minimumXp;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public int getNumber() { return number; }
    public void setNumber(int number) { this.number = number; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public long getMinimumXp() { return minimumXp; }
    public void setMinimumXp(long minimumXp) { this.minimumXp = minimumXp; }

}
