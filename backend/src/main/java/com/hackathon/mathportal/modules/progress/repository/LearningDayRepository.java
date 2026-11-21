package com.hackathon.mathportal.modules.progress.repository;

import com.hackathon.mathportal.modules.progress.entity.LearningDay;
import com.hackathon.mathportal.modules.progress.entity.LearningDayId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningDayRepository extends JpaRepository<LearningDay, LearningDayId> {
    List<LearningDay> findByIdStudentIdOrderByIdDateAsc(UUID studentId);
}

