package com.hackathon.mathportal.modules.exercises.repository;

import com.hackathon.mathportal.modules.exercises.entity.Activity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityRepository extends JpaRepository<Activity, UUID> {
    List<Activity> findByTopicIdAndActiveTrueOrderByOrderAscIdAsc(UUID topicId);
    List<Activity> findByActiveTrue();
}
