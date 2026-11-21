package com.hackathon.mathportal.modules.schools.dto;

import java.util.UUID;
import com.hackathon.mathportal.modules.auth.dto.SchoolRole;

public record SchoolView(UUID id, String name, SchoolRole role) {}
