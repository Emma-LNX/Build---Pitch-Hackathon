package com.hackathon.mathportal.modules.students.service;

import com.hackathon.mathportal.common.TransactionLocks;
import com.hackathon.mathportal.modules.auth.service.CurrentIdentity;
import com.hackathon.mathportal.modules.students.dto.StudentDtos.*;
import com.hackathon.mathportal.modules.students.entity.Student;
import com.hackathon.mathportal.modules.students.repository.StudentRepository;
import java.time.Clock;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class StudentService {
    private final StudentRepository students;
    private final CurrentIdentity identity;
    private final TransactionLocks locks;
    private final Clock clock;

    public StudentService(StudentRepository students, CurrentIdentity identity, TransactionLocks locks, Clock clock) {
        this.students = students;
        this.identity = identity;
        this.locks = locks;
        this.clock = clock;
    }

    @Transactional
    public Profile create(Create request) {
        String subject = identity.subject();
        locks.acquire("profile:" + subject);
        if (students.findByAuthSubject(subject).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un perfil para esta identidad");
        }
        var student = new Student();
        student.setId(UUID.randomUUID());
        student.setAuthSubject(subject);
        student.setAlias(alias(request.alias()));
        student.setAvatarKey(avatar(request.avatarKey()));
        student.setSchoolGrade(optionalText(request.schoolGrade()));
        student.setTimeZone(timeZone(request.timeZone() == null ? "America/Guatemala" : request.timeZone()));
        student.setRankingEnabled(Boolean.TRUE.equals(request.rankingEnabled()));
        student.setStatus("ACTIVO");
        student.setCreatedAt(clock.instant());
        student.setUpdatedAt(student.getCreatedAt());
        return profile(students.save(student));
    }

    public Profile getProfile() { return profile(current()); }

    @Transactional
    public Profile patch(Patch request) {
        var student = lockCurrent();
        if (request.alias() != null) student.setAlias(alias(request.alias()));
        if (request.avatarKey() != null) student.setAvatarKey(avatar(request.avatarKey()));
        if (request.schoolGrade() != null) student.setSchoolGrade(optionalText(request.schoolGrade()));
        if (request.timeZone() != null) student.setTimeZone(timeZone(request.timeZone()));
        if (request.rankingEnabled() != null) student.setRankingEnabled(request.rankingEnabled());
        student.setUpdatedAt(clock.instant());
        return profile(student);
    }

    public Student current() {
        return active(students.findByAuthSubject(identity.subject()).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Primero crea tu perfil de alumno")));
    }

    @Transactional
    public Student lockCurrent() {
        return active(students.findForUpdate(identity.subject()).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Primero crea tu perfil de alumno")));
    }

    private Student active(Student student) {
        if (!"ACTIVO".equals(student.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El perfil está inactivo");
        }
        return student;
    }

    private String alias(String value) {
        String result = value.strip();
        if (result.isBlank() || result.codePoints().anyMatch(Character::isISOControl)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El alias no es válido");
        }
        return result;
    }

    private String timeZone(String value) {
        if (!ZoneId.getAvailableZoneIds().contains(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usa una zona horaria IANA válida");
        }
        return value;
    }

    private String avatar(String value) {
        String result = optionalText(value);
        if (result != null && !result.matches("[A-Za-z0-9_-]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "avatarKey debe ser una clave, por ejemplo zorro_azul");
        }
        return result;
    }

    private String optionalText(String value) { return value == null || value.isBlank() ? null : value.strip(); }

    private Profile profile(Student s) {
        return new Profile(s.getId(), s.getAlias(), s.getAvatarKey(), s.getSchoolGrade(), s.getTimeZone(),
            s.getRankingEnabled(), s.getStatus(), s.getCreatedAt(), s.getUpdatedAt());
    }
}
