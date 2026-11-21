package com.hackathon.mathportal.modules.progress.repository;

import com.hackathon.mathportal.modules.progress.entity.ActivityProgress;
import com.hackathon.mathportal.modules.progress.entity.ActivityProgressId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityProgressRepository extends JpaRepository<ActivityProgress, ActivityProgressId> {
    List<ActivityProgress> findByIdStudentId(UUID studentId);
}
