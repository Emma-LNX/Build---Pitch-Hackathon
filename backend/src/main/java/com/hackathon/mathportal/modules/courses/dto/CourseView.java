package com.hackathon.mathportal.modules.courses.dto;

import java.util.UUID;

public record CourseView(UUID id, UUID schoolId, String name) {}
