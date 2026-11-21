package com.hackathon.mathportal.modules.progress;

import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.Streak;
import com.hackathon.mathportal.modules.progress.service.StreakCalculator;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import static org.assertj.core.api.Assertions.assertThat;

class StreakCalculatorTest {
    @ParameterizedTest
    @MethodSource("cases")
    void calculatesCurrentAndLongest(List<String> dates, int current, int longest) {
        assertThat(StreakCalculator.calculate(dates.stream().map(LocalDate::parse).toList(),
            LocalDate.parse("2026-11-21"))).isEqualTo(new Streak(current, longest));
    }

    static Stream<Arguments> cases() {
        return Stream.of(
            Arguments.of(List.of(), 0, 0),
            Arguments.of(List.of("2026-11-21"), 1, 1),
            Arguments.of(List.of("2026-11-19", "2026-11-20"), 2, 2),
            Arguments.of(List.of("2026-11-18", "2026-11-19"), 0, 2),
            Arguments.of(List.of("2026-11-18", "2026-11-19", "2026-11-21"), 1, 2),
            Arguments.of(List.of("2026-11-21", "2026-11-20", "2026-11-21"), 2, 2)
        );
    }
}
