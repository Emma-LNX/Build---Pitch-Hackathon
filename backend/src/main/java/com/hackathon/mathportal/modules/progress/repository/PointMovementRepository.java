package com.hackathon.mathportal.modules.progress.repository;

import com.hackathon.mathportal.modules.progress.entity.PointMovement;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PointMovementRepository extends JpaRepository<PointMovement, UUID> {
    Optional<PointMovement> findByAttemptId(UUID attemptId);

    @Query("select coalesce(sum(p.amount), 0) from PointMovement p where p.studentId = :studentId")
    long totalXp(@Param("studentId") UUID studentId);
}
