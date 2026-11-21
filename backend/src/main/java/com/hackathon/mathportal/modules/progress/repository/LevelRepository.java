package com.hackathon.mathportal.modules.progress.repository;

import com.hackathon.mathportal.modules.progress.entity.Level;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LevelRepository extends JpaRepository<Level, UUID> {
    List<Level> findAllByOrderByMinimumXpAsc();
}

