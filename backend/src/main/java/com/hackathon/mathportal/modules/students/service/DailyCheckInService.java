package com.hackathon.mathportal.modules.students.service;

import com.hackathon.mathportal.modules.students.dto.DailyCheckInDtos.*;
import com.hackathon.mathportal.modules.students.repository.DailyCheckInRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class DailyCheckInService {
    private final StudentService students;
    private final DailyCheckInRepository checkIns;
    private final Clock clock;

    public DailyCheckInService(StudentService students, DailyCheckInRepository checkIns, Clock clock) {
        this.students = students;
        this.checkIns = checkIns;
        this.clock = clock;
    }

    public Today today() {
        var student = students.current();
        var date = LocalDate.ofInstant(clock.instant(), ZoneId.of(student.getTimeZone()));
        var entry = checkIns.find(student.getId(), date).orElse(null);
        return new Today(date, entry == null, entry);
    }

    @Transactional
    public Entry sync(OfflineAnswers request) {
        var student = students.lockCurrent();
        var now = clock.instant();
        var today = LocalDate.ofInstant(now, ZoneId.of(student.getTimeZone()));
        if (request.date().isAfter(today) || request.date().isBefore(LocalDate.of(2000, 1, 1))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha reportada no es válida");
        }
        // La fecha offline es autodeclarada: no genera puntos ni modifica rachas.
        // Primer registro gana incluso al sincronizar dispositivos distintos.
        var existing = checkIns.find(student.getId(), request.date());
        if (existing.isPresent()) return existing.get();
        checkIns.insert(student.getId(), request.date(), student.getTimeZone(), now, request.answers());
        return checkIns.find(student.getId(), request.date()).orElseThrow();
    }

    @Transactional
    public Entry submit(Answers answers) {
        // Serializa envíos simultáneos y cambios de zona horaria del mismo alumno.
        var student = students.lockCurrent();
        var now = clock.instant();
        var date = LocalDate.ofInstant(now, ZoneId.of(student.getTimeZone()));
        var existing = checkIns.find(student.getId(), date);
        if (existing.isPresent()) {
            var saved = existing.get();
            boolean sameSleep = saved.sleepHours() == null ? answers.sleepHours() == null
                : answers.sleepHours() != null && saved.sleepHours().compareTo(answers.sleepHours()) == 0;
            if (sameSleep && saved.food() == answers.food() && saved.mood() == answers.mood()) return saved;
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya completaste el registro de hoy");
        }
        checkIns.insert(student.getId(), date, student.getTimeZone(), now, answers);
        return checkIns.find(student.getId(), date).orElseThrow();
    }
}
