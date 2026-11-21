package com.hackathon.mathportal.modules.parents.service;

import com.hackathon.mathportal.modules.classrooms.repository.ClassroomRepository;
import com.hackathon.mathportal.modules.parents.dto.ParentDtos.*;
import com.hackathon.mathportal.modules.parents.mail.ReportEmailSender;
import com.hackathon.mathportal.modules.parents.repository.ParentRepository;
import com.hackathon.mathportal.modules.teachers.dto.TeacherDtos.StudentProgress;
import com.hackathon.mathportal.modules.teachers.service.TeacherService;
import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ParentService {
    private final ParentRepository parents;
    private final TeacherService teachers;
    private final ClassroomRepository classrooms;
    private final ReportEmailSender emailSender;
    private final Clock clock;

    public ParentService(ParentRepository parents, TeacherService teachers, ClassroomRepository classrooms,
            ReportEmailSender emailSender, Clock clock) {
        this.parents = parents;
        this.teachers = teachers;
        this.classrooms = classrooms;
        this.emailSender = emailSender;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ParentContact> list(UUID actor, UUID school, UUID classroom, UUID student) {
        teachers.requireAssignedStudent(actor, school, classroom, student);
        return parents.list(school, classroom, student);
    }

    @Transactional
    public ParentContact create(UUID actor, UUID school, UUID classroom, UUID student, SaveParent request) {
        teachers.requireAssignedStudent(actor, school, classroom, student);
        SaveParent data = normalize(request);
        UUID id = UUID.randomUUID();
        parents.create(id, school, classroom, student, data.fullName(), data.relationship(),
            data.email(), data.phone(), actor);
        return existing(school, classroom, student, id);
    }

    @Transactional
    public ParentContact update(UUID actor, UUID school, UUID classroom, UUID student, UUID parent, SaveParent request) {
        teachers.requireAssignedStudent(actor, school, classroom, student);
        SaveParent data = normalize(request);
        if (!parents.update(school, classroom, student, parent, data.fullName(), data.relationship(),
                data.email(), data.phone())) throw unavailable();
        return existing(school, classroom, student, parent);
    }

    @Transactional
    public void delete(UUID actor, UUID school, UUID classroom, UUID student, UUID parent) {
        teachers.requireAssignedStudent(actor, school, classroom, student);
        if (!parents.delete(school, classroom, student, parent)) throw unavailable();
    }

    public ReportDelivery sendReport(UUID actor, UUID school, UUID classroom, UUID student, UUID parent) {
        return sendReportAt(actor, school, classroom, student, parent, clock.instant());
    }

    ReportDelivery sendReportAt(UUID actor, UUID school, UUID classroom, UUID student, UUID parent,
            java.time.Instant sentAt) {
        StudentProgress progress = teachers.studentProgress(actor, school, classroom, student);
        ParentContact contact = existing(school, classroom, student, parent);
        var room = classrooms.findById(school, classroom).orElseThrow(ParentService::unavailable);
        String child = progress.alias() == null ? "el estudiante" : progress.alias();
        String subject = "Reporte de progreso de " + child;
        String body = report(contact, progress, room.grade(), room.section(), room.academicYear());
        emailSender.send(contact.email(), subject, body);
        parents.markSent(school, classroom, student, parent, sentAt);
        return new ReportDelivery(parent, sentAt);
    }

    private ParentContact existing(UUID school, UUID classroom, UUID student, UUID parent) {
        return parents.find(school, classroom, student, parent).orElseThrow(ParentService::unavailable);
    }

    private static SaveParent normalize(SaveParent request) {
        String name = request.fullName().strip().replaceAll("\\s+", " ");
        String relationship = request.relationship().strip().replaceAll("\\s+", " ");
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        String phone = request.phone() == null || request.phone().isBlank() ? null : request.phone().strip();
        if (name.isBlank() || relationship.isBlank() || email.isBlank() || email.chars().anyMatch(Character::isISOControl)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Datos del contacto no válidos");
        }
        return new SaveParent(name, relationship, email, phone);
    }

    private static String report(ParentContact contact, StudentProgress progress,
            String grade, String section, int year) {
        String child = progress.alias() == null ? "el estudiante" : progress.alias();
        var stats = progress.statistics();
        var body = new StringBuilder()
            .append("Hola, ").append(contact.fullName()).append(".\n\n")
            .append("Este es el reporte de progreso de ").append(child).append(".\n")
            .append("Aula: ").append(grade).append(", sección ").append(section)
            .append(", ciclo ").append(year).append(".\n\n")
            .append("Partidas realizadas: ").append(stats.attempts()).append("\n")
            .append("Partidas aprobadas: ").append(stats.passedAttempts()).append("\n")
            .append("Porcentaje de aprobación: ").append(stats.passPercentage()).append("%\n")
            .append("Puntaje promedio: ").append(stats.averageScore()).append("%\n")
            .append("Actividades completadas: ").append(stats.completedActivities()).append("\n\n");
        if (progress.topics().isEmpty()) {
            body.append("Aún no hay temas practicados.\n");
        } else {
            body.append("Progreso por tema:\n");
            for (var topic : progress.topics()) {
                body.append("- ").append(topic.name()).append(": ")
                    .append(topic.passPercentage()).append("% de partidas aprobadas, ")
                    .append(topic.attempts()).append(" intentos");
                if (topic.difficult()) body.append(". Requiere apoyo según el profesor");
                body.append(".\n");
            }
        }
        return body.append("\nReporte enviado por el portal de matemáticas.\n").toString();
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Contacto no disponible");
    }
}
