package com.hackathon.mathportal.modules.progress.repository;

import com.hackathon.mathportal.modules.progress.entity.Attempt;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttemptRepository extends JpaRepository<Attempt, UUID> {
    Page<Attempt> findByStudentId(UUID studentId, Pageable pageable);
}

