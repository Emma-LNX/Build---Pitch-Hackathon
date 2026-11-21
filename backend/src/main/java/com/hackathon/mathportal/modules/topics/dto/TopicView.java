package com.hackathon.mathportal.modules.topics.dto;

import java.util.UUID;

public record TopicView(UUID id, UUID schoolId, UUID courseId, String title, String content, UUID createdBy) {}
