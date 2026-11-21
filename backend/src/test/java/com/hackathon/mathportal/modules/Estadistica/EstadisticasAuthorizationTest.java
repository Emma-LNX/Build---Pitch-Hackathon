package com.hackathon.mathportal.modules.Estadistica;

import static org.assertj.core.api.Assertions.*;
import java.time.Clock;
import java.util.UUID;
import com.hackathon.mathportal.modules.auth.service.CurrentIdentity;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

class EstadisticasAuthorizationTest {
    private final UUID teacher = UUID.randomUUID(), otherTeacher = UUID.randomUUID();
    private final UUID studentSubject = UUID.randomUUID(), studentId = UUID.randomUUID();
    private final UUID school = UUID.randomUUID(), course = UUID.randomUUID(), unassigned = UUID.randomUUID();
    private JdbcTemplate jdbc;
    private EstadisticasRepository repository;
    private EstadisticasService service;

    @BeforeEach
    void setup() {
        var source = new DriverManagerDataSource("jdbc:h2:mem:stats-" + UUID.randomUUID()
            + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE SCHEMA math_portal");
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V3__school_rbac.sql")).execute(source);
        jdbc.execute("""
            CREATE TABLE math_portal.alumnos (id uuid PRIMARY KEY, auth_subject varchar(255),
                alias varchar(40), zona_horaria varchar(100), estado varchar(20))
            """);
        jdbc.update("INSERT INTO math_portal.schools VALUES (?, 'Colegio')", school);
        jdbc.update("INSERT INTO math_portal.courses VALUES (?, ?, 'Curso'), (?, ?, 'Otro')",
            course, school, unassigned, school);
        jdbc.update("INSERT INTO math_portal.alumnos VALUES (?, ?, 'Ana', 'America/Guatemala', 'ACTIVO')",
            studentId, studentSubject.toString());
        jdbc.update("INSERT INTO math_portal.school_memberships VALUES (?, ?, 'PROFESOR'), (?, ?, 'PROFESOR'), (?, ?, 'ALUMNO')",
            school, teacher, school, otherTeacher, school, studentSubject);
        enroll(course, teacher, "PROFESOR");
        enroll(unassigned, otherTeacher, "PROFESOR");
        enroll(course, studentSubject, "ALUMNO");
        repository = new EstadisticasRepository(jdbc);
        service = new EstadisticasService(repository, new CurrentIdentity(), Clock.systemUTC());
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        jdbc.execute("DROP ALL OBJECTS");
    }

    @Test
    void profileIdIsResolvedThroughAuthSubjectAndTeacherMustShareCourse() {
        assertThat(repository.propia(studentSubject.toString()).orElseThrow().id()).isEqualTo(studentId);
        assertThat(repository.asignada(teacher, studentId)).isPresent();
        assertThat(repository.asignada(otherTeacher, studentId)).isEmpty();
        assertThat(repository.asignada(teacher, studentSubject)).isEmpty();
        assertThat(repository.alumnos(teacher, 0, 20).totalElements()).isEqualTo(1);
        assertThat(repository.alumnos(otherTeacher, 0, 20).content()).isEmpty();
    }

    @Test
    void repeatedSharedCoursesDoNotDuplicateStudentAndRevocationIsImmediate() {
        enroll(unassigned, teacher, "PROFESOR");
        enroll(unassigned, studentSubject, "ALUMNO");
        assertThat(repository.alumnos(teacher, 0, 1).totalElements()).isEqualTo(1);
        jdbc.update("DELETE FROM math_portal.course_memberships WHERE user_id = ?", teacher);
        assertThat(repository.asignada(teacher, studentId)).isEmpty();
        assertThat(repository.alumnos(teacher, 0, 20).content()).isEmpty();
    }

    @Test
    void forgedJwtRoleCannotGrantTeacherAccessAndForeignStudentReturns404() {
        authenticate(studentSubject);
        assertThatThrownBy(() -> service.alumnos(0, 20)).isInstanceOfSatisfying(
            ResponseStatusException.class, ex -> assertThat(ex.getStatusCode().value()).isEqualTo(403));
        authenticate(otherTeacher);
        for (var history : EstadisticasRepository.Historial.values()) {
            assertThatThrownBy(() -> service.historialAlumno(studentId, history, 0, 20))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                    ex -> assertThat(ex.getStatusCode().value()).isEqualTo(404));
        }
    }

    @Test
    void paginationIsBoundedAndInactiveStudentsAreHidden() {
        assertThatThrownBy(() -> repository.alumnos(teacher, -1, 20)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> repository.alumnos(teacher, 0, 101)).isInstanceOf(ResponseStatusException.class);
        jdbc.update("UPDATE math_portal.alumnos SET estado = 'INACTIVO' WHERE id = ?", studentId);
        assertThat(repository.propia(studentSubject.toString())).isEmpty();
        assertThat(repository.asignada(teacher, studentId)).isEmpty();
    }

    private void enroll(UUID targetCourse, UUID user, String role) {
        jdbc.update("INSERT INTO math_portal.course_memberships VALUES (?, ?, ?, ?)", school, targetCourse, user, role);
    }

    private void authenticate(UUID subject) {
        var jwt = Jwt.withTokenValue("test").header("alg", "RS256").subject(subject.toString())
            .claim("role", "PROFESOR").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}