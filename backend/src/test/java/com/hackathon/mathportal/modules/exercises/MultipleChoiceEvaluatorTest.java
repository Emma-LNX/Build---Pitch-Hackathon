package com.hackathon.mathportal.modules.exercises;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackathon.mathportal.modules.exercises.entity.ActivityVersion;
import com.hackathon.mathportal.modules.exercises.service.MultipleChoiceEvaluator;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class MultipleChoiceEvaluatorTest {
    private final ObjectMapper json = new ObjectMapper();
    private final MultipleChoiceEvaluator evaluator = new MultipleChoiceEvaluator();

    private ActivityVersion version() throws Exception {
        var version = new ActivityVersion();
        version.setContent(json.readTree("""
            {"questions":[
              {"id":"q1","options":[{"id":"a"},{"id":"b"}]},
              {"id":"q2","options":[{"id":"a"},{"id":"b"}]},
              {"id":"q3","options":[{"id":"a"},{"id":"b"}]}
            ]}
            """));
        version.setEvaluationRules(json.readTree("""
            {"passingPercentage":66.67,"correctAnswers":{"q1":"a","q2":"a","q3":"a"}}
            """));
        return version;
    }

    @Test
    void evaluatesOnServerAndDoesNotRoundANearMissIntoAPass() throws Exception {
        var result = evaluator.evaluate(version(), Map.of("q1", "a", "q2", "a", "q3", "b"));
        assertThat(result.score()).isEqualByComparingTo("66.67");
        assertThat(result.passed()).isFalse();
    }

    @Test
    void acceptsAllCorrectAnswers() throws Exception {
        var result = evaluator.evaluate(version(), Map.of("q1", "a", "q2", "a", "q3", "a"));
        assertThat(result.score()).isEqualByComparingTo("100");
        assertThat(result.passed()).isTrue();
    }

    @Test
    void unansweredQuestionsCountAsIncorrect() throws Exception {
        assertThat(evaluator.evaluate(version(), Map.of("q1", "a")).score()).isEqualByComparingTo("33.33");
    }

    @Test
    void rejectsUnknownQuestionsAndOptions() throws Exception {
        var v = version();
        assertThatThrownBy(() -> evaluator.evaluate(v, Map.of("q4", "a")))
            .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> evaluator.evaluate(v, Map.of("q1", "z")))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void rejectsVersionsWithMissingAnswerKey() throws Exception {
        var v = version();
        v.setEvaluationRules(json.readTree("{\"passingPercentage\":50,\"correctAnswers\":{}}"));
        assertThatThrownBy(() -> evaluator.evaluate(v, Map.of("q1", "a")))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("422");
    }
}
