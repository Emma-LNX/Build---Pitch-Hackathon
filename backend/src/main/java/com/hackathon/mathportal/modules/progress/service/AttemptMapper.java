package com.hackathon.mathportal.modules.progress.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.*;
import com.hackathon.mathportal.modules.progress.entity.Attempt;
import com.hackathon.mathportal.modules.progress.repository.PointMovementRepository;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class AttemptMapper {
    private final ObjectMapper json;
    private final PointMovementRepository points;

    public AttemptMapper(ObjectMapper json, PointMovementRepository points) {
        this.json = json;
        this.points = points;
    }

    public AttemptView view(Attempt a) {
        Map<String, String> answers = json.convertValue(a.getAnswers(), new TypeReference<>() {});
        int awarded = points.findByAttemptId(a.getId()).map(p -> p.getAmount()).orElse(0);
        return new AttemptView(a.getId(), a.getActivityVersionId(), answers, a.getScorePercentage(),
            a.getPassed(), Origin.valueOf(a.getOrigin()), a.getClientFinishedAt(), a.getReceivedAt(),
            a.getLearningDate(), a.getAppliedTimeZone(), awarded);
    }
}
