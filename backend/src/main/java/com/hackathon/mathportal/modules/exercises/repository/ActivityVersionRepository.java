package com.hackathon.mathportal.modules.exercises.repository;

import com.hackathon.mathportal.modules.exercises.entity.ActivityVersion;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityVersionRepository extends JpaRepository<ActivityVersion, UUID> {
    Optional<ActivityVersion> findFirstByActivityIdAndPublishedAtLessThanEqualOrderByVersionNumberDesc(
        UUID activityId, Instant now);
}

