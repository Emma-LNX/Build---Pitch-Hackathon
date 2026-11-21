package com.hackathon.mathportal.modules.classrooms.service;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import com.hackathon.mathportal.modules.auth.repository.MembershipRepository;
import com.hackathon.mathportal.modules.auth.service.SchoolAdministrationAccess;
import com.hackathon.mathportal.modules.classrooms.dto.ClassroomDtos.*;
import com.hackathon.mathportal.modules.classrooms.repository.ClassroomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class ClassroomService {
    private final ClassroomRepository classrooms;
    private final MembershipRepository memberships;
    private final SchoolAdministrationAccess access;

    public ClassroomService(ClassroomRepository classrooms, MembershipRepository memberships, SchoolAdministrationAccess access) {
        this.classrooms = classrooms;
        this.memberships = memberships;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public List<ClassroomView> list(UUID actor, UUID school, Integer year) {
        if (year != null && (year < 1 || year > 9999)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ciclo escolar no válido");
        if (!memberships.belongsToSchool(actor, school)) throw notFound();
        return classrooms.visibleFor(actor, school, year);
    }

    @Transactional(readOnly = true)
    public ClassroomView get(UUID actor, UUID school, UUID classroom) {
        return classrooms.visibleById(actor, school, classroom).orElseThrow(ClassroomService::notFound);
    }

    public ClassroomView create(UUID actor, UUID school, CreateClassroom request) {
        access.requireDirector(actor, school);
        requireTeacher(school, request.teacherId());
        UUID classroom = UUID.randomUUID();
        classrooms.create(school, classroom, normalize(request.grade()), normalize(request.section()), request.academicYear(), request.teacherId());
        return existing(school, classroom);
    }

    public ClassroomView update(UUID actor, UUID school, UUID classroom, UpdateClassroom request) {
        access.requireDirector(actor, school);
        existing(school, classroom);
        requireTeacher(school, request.teacherId());
        classrooms.update(school, classroom, normalize(request.grade()), normalize(request.section()), request.teacherId());
        return existing(school, classroom);
    }

    public void delete(UUID actor, UUID school, UUID classroom) {
        access.requireDirector(actor, school);
        existing(school, classroom);
        if (!classrooms.deleteEmpty(school, classroom)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Retira o traslada a los alumnos antes de eliminar el aula");
        }
    }

    public List<StudentView> students(UUID actor, UUID school, UUID classroom) {
        ClassroomView current = get(actor, school, classroom);
        if (!current.teacherId().equals(actor)) {
            if (!access.isDirector(actor, school)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el director y el profesor del aula pueden consultar sus estudiantes");
            access.requireDirector(actor, school);
        }
        return classrooms.students(school, classroom);
    }

    public void enroll(UUID actor, UUID school, UUID classroom, UUID student) {
        access.requireDirector(actor, school);
        ClassroomView current = existing(school, classroom);
        if (!classrooms.hasRole(school, student, "ALUMNO")) throw notFound();
        var assigned = classrooms.classroomForStudent(school, current.academicYear(), student);
        if (assigned.isPresent()) {
            if (assigned.get().equals(classroom)) return;
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El alumno ya pertenece a otra aula de esta escuela en el mismo ciclo escolar");
        }
        classrooms.enroll(school, classroom, current.academicYear(), student);
    }

    public void unenroll(UUID actor, UUID school, UUID classroom, UUID student) {
        access.requireDirector(actor, school);
        existing(school, classroom);
        if (!classrooms.unenroll(school, classroom, student)) throw notFound();
    }

    public void transfer(UUID actor, UUID school, UUID classroom, UUID student, TransferStudent request) {
        access.requireDirector(actor, school);
        ClassroomView source = existing(school, classroom);
        ClassroomView target = existing(school, request.targetClassroomId());
        if (source.academicYear() != target.academicYear()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El traslado debe ser entre aulas del mismo ciclo escolar");
        }
        if (!classrooms.transfer(school, classroom, target.id(), student)) throw notFound();
    }
    private ClassroomView existing(UUID school, UUID classroom) {
        return classrooms.findById(school, classroom).orElseThrow(ClassroomService::notFound);
    }
    private void requireTeacher(UUID school, UUID teacher) {
        if (!classrooms.hasRole(school, teacher, "PROFESOR")) throw notFound();
    }
    private static String normalize(String text) { return text.strip().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT); }
    private static ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Recurso no disponible"); }
}
