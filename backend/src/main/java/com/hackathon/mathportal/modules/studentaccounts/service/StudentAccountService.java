package com.hackathon.mathportal.modules.studentaccounts.service;

import java.time.Clock;
import java.util.Locale;
import java.util.UUID;
import com.hackathon.mathportal.modules.accounts.service.AuthProperties;
import com.hackathon.mathportal.modules.auth.client.SupabaseAdminClient;
import com.hackathon.mathportal.modules.auth.service.SchoolAdministrationAccess;
import com.hackathon.mathportal.modules.classrooms.dto.ClassroomDtos.ClassroomView;
import com.hackathon.mathportal.modules.classrooms.repository.ClassroomRepository;
import com.hackathon.mathportal.modules.studentaccounts.dto.StudentAccountDtos.*;
import com.hackathon.mathportal.modules.studentaccounts.repository.StudentAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Cuentas de alumnos con usuario y contraseña, creadas por el personal de la escuela.
 * El usuario vive en Supabase Auth con el correo interno `usuario@alumnos.mayamente.app`.
 * No usa @Transactional: la llamada a Supabase queda fuera de la transacción y,
 * si la parte de base de datos falla, se borra el usuario recién creado.
 */
@Service
public class StudentAccountService {
    public static final String EMAIL_DOMAIN = "@alumnos.mayamente.app";
    private static final String DEFAULT_TIME_ZONE = "America/Guatemala";
    private static final int MAX_GRADE_LENGTH = 30;
    private static final Logger LOG = LoggerFactory.getLogger(StudentAccountService.class);

    private final StudentAccountRepository accounts;
    private final ClassroomRepository classrooms;
    private final SchoolAdministrationAccess access;
    private final SupabaseAdminClient supabase;
    private final TransactionTemplate transactions;
    private final Clock clock;
    /** Dominio de las cuentas creadas por curso (modules/accounts); también las gestiona la escuela. */
    private final String courseAccountDomain;

    public StudentAccountService(StudentAccountRepository accounts, ClassroomRepository classrooms,
            SchoolAdministrationAccess access, SupabaseAdminClient supabase,
            PlatformTransactionManager transactionManager, Clock clock, AuthProperties auth) {
        this.accounts = accounts;
        this.classrooms = classrooms;
        this.access = access;
        this.supabase = supabase;
        this.transactions = new TransactionTemplate(transactionManager);
        this.clock = clock;
        this.courseAccountDomain = "@" + auth.studentEmailDomain();
    }

    public StudentAccountView create(UUID actor, UUID school, UUID classroom, CreateStudentAccount request) {
        String username = request.username().toLowerCase(Locale.ROOT);
        String alias = alias(request.alias());
        transactions.executeWithoutResult(status -> authorize(actor, school, classroom));
        UUID user = supabase.createStudentUser(username + EMAIL_DOMAIN, request.password(), username, alias);
        try {
            transactions.executeWithoutResult(status -> register(actor, school, classroom, user, alias));
        } catch (RuntimeException failure) {
            compensate(user, failure);
            throw failure;
        }
        return new StudentAccountView(user, username, alias, classroom);
    }

    public void changePassword(UUID actor, UUID school, UUID classroom, UUID student, ChangePassword request) {
        transactions.executeWithoutResult(status -> {
            authorize(actor, school, classroom);
            // Solo cuentas creadas por la escuela: nunca la de un alumno que entra con su propio correo.
            boolean managed = accounts.accountEmail(student)
                .map(email -> email.endsWith(EMAIL_DOMAIN) || email.endsWith(courseAccountDomain)).orElse(false);
            if (!managed || !accounts.enrolled(school, classroom, student)) throw notFound();
        });
        supabase.updatePassword(student, request.password());
    }

    private void register(UUID actor, UUID school, UUID classroom, UUID user, String alias) {
        authorize(actor, school, classroom);
        accounts.lockClassroom(school, classroom);
        // Tras el bloqueo se relee el aula: un cambio de profesor concurrente ya quedó confirmado.
        ClassroomView room = authorize(actor, school, classroom);
        if (classrooms.classroomForStudent(school, room.academicYear(), user).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El alumno ya pertenece a otra aula de esta escuela en el mismo ciclo escolar");
        }
        accounts.addStudentMembership(school, user);
        classrooms.enroll(school, classroom, room.academicYear(), user);
        accounts.createProfile(UUID.randomUUID(), user.toString(), alias, grade(room.grade()), DEFAULT_TIME_ZONE, clock.instant());
    }

    // El profesor responsable administra su aula; cualquier otro actor debe ser director de la escuela.
    private ClassroomView authorize(UUID actor, UUID school, UUID classroom) {
        var room = classrooms.findById(school, classroom);
        if (room.isPresent() && room.get().teacherId().equals(actor) && classrooms.hasRole(school, actor, "PROFESOR")) {
            return room.get();
        }
        access.requireDirector(actor, school);
        return room.orElseThrow(StudentAccountService::notFound);
    }

    private void compensate(UUID user, RuntimeException failure) {
        try {
            supabase.deleteUser(user);
        } catch (RuntimeException cleanup) {
            LOG.error("No se pudo borrar el usuario {} de Supabase después de fallar el registro en la base de datos", user, cleanup);
            failure.addSuppressed(cleanup);
        }
    }

    private static String alias(String value) {
        String result = value.strip();
        if (result.isBlank() || result.codePoints().anyMatch(Character::isISOControl)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El alias no es válido");
        }
        return result;
    }

    private static String grade(String classroomGrade) {
        return classroomGrade.length() <= MAX_GRADE_LENGTH ? classroomGrade : classroomGrade.substring(0, MAX_GRADE_LENGTH).strip();
    }

    private static ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Recurso no disponible"); }
}
