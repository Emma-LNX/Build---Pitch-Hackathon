package com.hackathon.mathportal.modules.accounts.service;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import com.hackathon.mathportal.modules.accounts.dto.AccountDtos.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Cuentas de estudiante administradas por su profesor.
 * Todos los permisos se comprueban aquí contra la base: un profesor solo
 * opera sobre cursos donde está asignado como PROFESOR.
 */
@Service
public class StudentAccountService {
    private static final Logger LOG = LoggerFactory.getLogger(StudentAccountService.class);

    private final JdbcTemplate jdbc;
    private final AuthGateway auth;
    private final AuthProperties props;
    private final TransactionTemplate tx;
    private final Clock clock;

    public StudentAccountService(JdbcTemplate jdbc, AuthGateway auth, AuthProperties props, TransactionTemplate tx, Clock clock) {
        this.jdbc = jdbc;
        this.auth = auth;
        this.props = props;
        this.tx = tx;
        this.clock = clock;
    }

    /** Correo interno con el que Supabase Auth identifica a la cuenta. El estudiante nunca lo usa. */
    public String studentEmail(String username) {
        return normalize(username) + "@" + props.studentEmailDomain();
    }

    public static String normalize(String username) { return username.strip().toLowerCase(Locale.ROOT); }

    public List<TeacherClass> classes(UUID teacher) {
        return jdbc.query("""
            SELECT s.id AS school_id, s.name AS school_name, c.id AS course_id, c.name AS course_name
            FROM math_portal.course_memberships m
            JOIN math_portal.courses c ON c.school_id = m.school_id AND c.id = m.course_id
            JOIN math_portal.schools s ON s.id = c.school_id
            WHERE m.user_id = ? AND m.role = 'PROFESOR'
            ORDER BY s.name, c.name, c.id
            """, (rs, row) -> new TeacherClass(rs.getObject("school_id", UUID.class), rs.getString("school_name"),
                rs.getObject("course_id", UUID.class), rs.getString("course_name")), teacher);
    }

    public List<StudentAccount> students(UUID teacher, UUID course) {
        requireTeacher(teacher, course);
        return jdbc.query("""
            SELECT user_id, display_name, username, course_id, created_at, password_reset_at
            FROM math_portal.student_accounts WHERE course_id = ? ORDER BY display_name, username
            """, (rs, row) -> new StudentAccount(rs.getObject("user_id", UUID.class), rs.getString("display_name"),
                rs.getString("username"), rs.getObject("course_id", UUID.class),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("password_reset_at") == null ? null : rs.getTimestamp("password_reset_at").toInstant()),
            course);
    }

    public StudentAccount create(UUID teacher, UUID course, CreateStudent request) {
        UUID school = requireTeacher(teacher, course);
        String username = request.username().strip();
        String normalized = normalize(username);
        String name = request.displayName().strip();
        if (usernameTaken(normalized)) throw conflict();

        UUID userId;
        try {
            userId = auth.createUser(studentEmail(normalized), request.password(), name);
        } catch (AuthGateway.DuplicateUserException ex) {
            throw conflict();
        }

        var now = Timestamp.from(clock.instant());
        try {
            tx.executeWithoutResult(status -> {
                jdbc.update("INSERT INTO math_portal.school_memberships (school_id, user_id, role) VALUES (?, ?, 'ALUMNO')", school, userId);
                jdbc.update("INSERT INTO math_portal.course_memberships (school_id, course_id, user_id, role) VALUES (?, ?, ?, 'ALUMNO')",
                    school, course, userId);
                jdbc.update("""
                    INSERT INTO math_portal.student_accounts
                        (user_id, username, username_normalized, display_name, school_id, course_id, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, userId, username, normalized, name, school, course, teacher, now);
                // Perfil de alumno listo desde el primer acceso (el alias es el nombre que dio el profesor).
                jdbc.update("""
                    INSERT INTO math_portal.alumnos (id, auth_subject, alias, zona_horaria, participa_ranking, estado, creado_en, actualizado_en)
                    VALUES (?, ?, ?, 'America/Guatemala', false, 'ACTIVO', ?, ?)
                    """, UUID.randomUUID(), userId.toString(), name, now, now);
            });
        } catch (RuntimeException ex) {
            // Compensación: no dejar un usuario de Auth sin cuenta en la API.
            try {
                auth.deleteUser(userId);
            } catch (RuntimeException cleanup) {
                LOG.error("No se pudo eliminar el usuario de Auth {} tras un fallo al crear la cuenta", userId, cleanup);
            }
            if (usernameTaken(normalized)) throw conflict();
            throw ex;
        }
        return new StudentAccount(userId, name, username, course, now.toInstant(), null);
    }

    public void resetPassword(UUID teacher, UUID student, ResetPassword request) {
        var account = account(student);
        requireTeacher(teacher, account.course());
        auth.updatePassword(student, request.password());
        jdbc.update("UPDATE math_portal.student_accounts SET password_reset_at = ? WHERE user_id = ?",
            Timestamp.from(clock.instant()), student);
    }

    public void move(UUID teacher, UUID student, MoveStudent request) {
        var account = account(student);
        requireTeacher(teacher, account.course());
        UUID targetSchool = requireTeacher(teacher, request.courseId());
        if (!targetSchool.equals(account.school())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La clase debe ser del mismo colegio");
        }
        if (request.courseId().equals(account.course())) return;
        tx.executeWithoutResult(status -> {
            jdbc.update("DELETE FROM math_portal.course_memberships WHERE school_id = ? AND course_id = ? AND user_id = ?",
                account.school(), account.course(), student);
            jdbc.update("INSERT INTO math_portal.course_memberships (school_id, course_id, user_id, role) VALUES (?, ?, ?, 'ALUMNO')",
                account.school(), request.courseId(), student);
            jdbc.update("UPDATE math_portal.student_accounts SET course_id = ? WHERE user_id = ?", request.courseId(), student);
        });
    }

    /** La clase del estudiante autenticado, tomada de la cuenta que creó su profesor. */
    public MyClass myClass(UUID student) {
        return jdbc.query("""
            SELECT a.display_name, a.username, a.school_id, s.name AS school_name, a.course_id, c.name AS course_name,
                   (SELECT al.genero FROM math_portal.alumnos al WHERE al.auth_subject = ?) AS genero
            FROM math_portal.student_accounts a
            JOIN math_portal.schools s ON s.id = a.school_id
            JOIN math_portal.courses c ON c.school_id = a.school_id AND c.id = a.course_id
            JOIN math_portal.course_memberships m
                ON m.school_id = a.school_id AND m.course_id = a.course_id AND m.user_id = a.user_id AND m.role = 'ALUMNO'
            WHERE a.user_id = ?
            """, (rs, row) -> new MyClass(student, rs.getString("display_name"), rs.getString("username"),
                rs.getObject("school_id", UUID.class), rs.getString("school_name"),
                rs.getObject("course_id", UUID.class), rs.getString("course_name"), rs.getString("genero")),
            student.toString(), student).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No tienes una clase asignada"));
    }

    public boolean isStudentAccount(UUID userId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM math_portal.student_accounts WHERE user_id = ?)", Boolean.class, userId));
    }

    private record Account(UUID school, UUID course) {}

    private Account account(UUID student) {
        return jdbc.query("SELECT school_id, course_id FROM math_portal.student_accounts WHERE user_id = ?",
                (rs, row) -> new Account(rs.getObject("school_id", UUID.class), rs.getObject("course_id", UUID.class)), student)
            .stream().findFirst().orElseThrow(StudentAccountService::notFound);
    }

    /** Devuelve el colegio del curso si el usuario es su profesor; si no, 404 (no revela si existe). */
    private UUID requireTeacher(UUID teacher, UUID course) {
        return jdbc.query("""
                SELECT school_id FROM math_portal.course_memberships
                WHERE course_id = ? AND user_id = ? AND role = 'PROFESOR'
                """, (rs, row) -> rs.getObject("school_id", UUID.class), course, teacher)
            .stream().findFirst().orElseThrow(StudentAccountService::notFound);
    }

    private boolean usernameTaken(String normalized) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM math_portal.student_accounts WHERE username_normalized = ?)", Boolean.class, normalized));
    }

    private static ResponseStatusException conflict() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Ese nombre de usuario ya existe. Elige otro.");
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Recurso no disponible");
    }
}
