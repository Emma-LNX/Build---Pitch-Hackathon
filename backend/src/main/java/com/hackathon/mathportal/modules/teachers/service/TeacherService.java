package com.hackathon.mathportal.modules.teachers.service;

import com.hackathon.mathportal.modules.Estadistica.EstadisticasService;
import com.hackathon.mathportal.modules.classrooms.dto.ClassroomDtos.ClassroomView;
import com.hackathon.mathportal.modules.classrooms.repository.ClassroomRepository;
import com.hackathon.mathportal.modules.teachers.dto.TeacherDtos.*;
import com.hackathon.mathportal.modules.teachers.repository.TeacherRepository;
import com.hackathon.mathportal.modules.teachers.repository.TeacherRepository.RawStatistics;
import com.hackathon.mathportal.modules.teachers.repository.TeacherRepository.RawTopic;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class TeacherService {
    private final TeacherRepository teachers;
    private final ClassroomRepository classrooms;
    private final EstadisticasService statistics;

    public TeacherService(TeacherRepository teachers, ClassroomRepository classrooms, EstadisticasService statistics) {
        this.teachers = teachers;
        this.classrooms = classrooms;
        this.statistics = statistics;
    }

    public Teacher me(UUID actor, UUID school) {
        String email = teachers.teacherEmail(school, actor);
        if (email == null) throw unavailable();
        List<ClassroomView> mine = classrooms.visibleFor(actor, school, null).stream()
            .filter(room -> room.teacherId().equals(actor)).toList();
        return new Teacher(actor, school, email, mine);
    }

    public ClassroomStatistics classroomStatistics(UUID actor, UUID school, UUID classroom) {
        ClassroomView room = ownRoom(actor, school, classroom);
        return new ClassroomStatistics(classroom, room.studentCount(), teachers.activeStudents(school, classroom),
            summarize(teachers.classroomStatistics(school, classroom)),
            teachers.classroomTopics(school, classroom).stream().map(this::summarize).toList());
    }

    public StudentProgress studentProgress(UUID actor, UUID school, UUID classroom, UUID student) {
        ownStudent(actor, school, classroom, student);
        return new StudentProgress(student, teachers.alias(student), summarize(teachers.studentStatistics(student)),
            teachers.studentTopics(school, classroom, student).stream().map(this::summarize).toList());
    }

    public void requireAssignedStudent(UUID actor, UUID school, UUID classroom, UUID student) {
        ownStudent(actor, school, classroom, student);
    }

    @Transactional
    public StudentProgress selectDifficult(UUID actor, UUID school, UUID classroom, UUID student, UUID topic) {
        ownRoom(actor, school, classroom);
        teachers.lockClassroom(school, classroom);
        ownStudent(actor, school, classroom, student);
        if (!teachers.isDifficult(school, classroom, student, topic)
                && !teachers.selectDifficult(school, classroom, student, topic, actor)) throw unavailable();
        return studentProgress(actor, school, classroom, student);
    }

    @Transactional
    public void clearDifficult(UUID actor, UUID school, UUID classroom, UUID student, UUID topic) {
        ownStudent(actor, school, classroom, student);
        teachers.clearDifficult(school, classroom, student, topic);
    }

    private ClassroomView ownRoom(UUID actor, UUID school, UUID classroom) {
        ClassroomView room = classrooms.findById(school, classroom).orElseThrow(TeacherService::unavailable);
        if (!room.teacherId().equals(actor) || !classrooms.hasRole(school, actor, "PROFESOR")) throw unavailable();
        return room;
    }

    private void ownStudent(UUID actor, UUID school, UUID classroom, UUID student) {
        ownRoom(actor, school, classroom);
        if (!teachers.enrolled(school, classroom, student)) throw unavailable();
    }

    private Statistics summarize(RawStatistics raw) {
        return new Statistics(raw.attempts(), raw.passedAttempts(), percentage(raw.passedAttempts(), raw.attempts()),
            score(raw.averageScore()), raw.completedActivities());
    }

    private TopicStatistics summarize(RawTopic raw) {
        return new TopicStatistics(raw.id(), raw.name(), raw.attempts(), raw.passedAttempts(),
            percentage(raw.passedAttempts(), raw.attempts()), score(raw.averageScore()), raw.lastAttemptAt(), raw.difficult());
    }

    private double percentage(long passed, long total) {
        if (total == 0) return 0;
        return BigDecimal.valueOf(statistics.calcularPorcentajeAciertos(Math.toIntExact(passed), Math.toIntExact(total)))
            .setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
    private static BigDecimal score(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }
    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Recurso no disponible");
    }
}
