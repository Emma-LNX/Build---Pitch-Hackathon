package com.hackathon.mathportal.modules.exercises.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hackathon.mathportal.modules.exercises.entity.ActivityVersion;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class MultipleChoiceEvaluator {
    public record Evaluation(BigDecimal score, boolean passed) {}

    public Evaluation evaluate(ActivityVersion version, Map<String, String> answers) {
        JsonNode questions = version.getContent().path("questions");
        JsonNode correct = version.getEvaluationRules().path("correctAnswers");
        JsonNode threshold = version.getEvaluationRules().path("passingPercentage");
        if (!questions.isArray() || questions.isEmpty() || questions.size() > 100 || !correct.isObject()
                || !threshold.isNumber() || threshold.decimalValue().signum() <= 0
                || threshold.decimalValue().compareTo(BigDecimal.valueOf(100)) > 0) throw invalidVersion();

        Map<String, Set<String>> optionsByQuestion = new HashMap<>();
        for (JsonNode question : questions) {
            String questionId = question.path("id").asText("");
            JsonNode options = question.path("options");
            if (questionId.isBlank() || !options.isArray() || options.isEmpty()) throw invalidVersion();
            Set<String> optionIds = new HashSet<>();
            for (JsonNode option : options) {
                String optionId = option.path("id").asText("");
                if (optionId.isBlank() || !optionIds.add(optionId)) throw invalidVersion();
            }
            if (optionsByQuestion.put(questionId, optionIds) != null
                    || !correct.path(questionId).isTextual()
                    || !optionIds.contains(correct.path(questionId).asText())) throw invalidVersion();
        }
        if (correct.size() != questions.size()) throw invalidVersion();
        for (var answer : answers.entrySet()) {
            if (!optionsByQuestion.containsKey(answer.getKey())
                    || !optionsByQuestion.get(answer.getKey()).contains(answer.getValue())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pregunta u opción de respuesta desconocida");
            }
        }
        long hits = answers.entrySet().stream()
            .filter(a -> a.getValue().equals(correct.path(a.getKey()).asText())).count();
        BigDecimal rawPoints = BigDecimal.valueOf(hits * 100);
        BigDecimal score = rawPoints.divide(BigDecimal.valueOf(questions.size()), 2, RoundingMode.HALF_UP);
        // Compare without rounding so a near miss cannot become a pass through display rounding.
        boolean passed = rawPoints.compareTo(threshold.decimalValue().multiply(BigDecimal.valueOf(questions.size()))) >= 0;
        return new Evaluation(score, passed);
    }

    private ResponseStatusException invalidVersion() {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "La versión no se puede evaluar");
    }
}
