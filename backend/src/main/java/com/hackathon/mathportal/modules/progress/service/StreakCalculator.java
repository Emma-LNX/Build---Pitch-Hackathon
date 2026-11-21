package com.hackathon.mathportal.modules.progress.service;

import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.Streak;
import java.time.LocalDate;
import java.util.Collection;
import java.util.TreeSet;

public final class StreakCalculator {
    private StreakCalculator() {}

    public static Streak calculate(Collection<LocalDate> dates, LocalDate today) {
        int run = 0;
        int longest = 0;
        LocalDate previous = null;
        for (LocalDate date : new TreeSet<>(dates)) {
            run = previous != null && date.equals(previous.plusDays(1)) ? run + 1 : 1;
            longest = Math.max(longest, run);
            previous = date;
        }
        boolean current = previous != null && (previous.equals(today) || previous.equals(today.minusDays(1)));
        return new Streak(current ? run : 0, longest);
    }
}
