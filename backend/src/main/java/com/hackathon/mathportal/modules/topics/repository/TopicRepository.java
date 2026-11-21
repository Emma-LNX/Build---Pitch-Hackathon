package com.hackathon.mathportal.modules.topics.repository;

import com.hackathon.mathportal.modules.topics.entity.Topic;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TopicRepository extends JpaRepository<Topic, UUID> {
    List<Topic> findByActiveTrueOrderByOrderAscIdAsc();
}
