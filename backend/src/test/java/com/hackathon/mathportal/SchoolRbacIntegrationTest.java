package com.hackathon.mathportal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:rbac;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.flyway.target=1"
})
@AutoConfigureMockMvc
@Import(RbacTestDatabaseConfig.class)
class SchoolRbacIntegrationTest {
    private static final String ISSUER = "https://test-project.supabase.co/auth/v1";
    private static final UUID SCHOOL_A = id(1), SCHOOL_B = id(2);
    private static final UUID COURSE_A = id(11), COURSE_A2 = id(12), COURSE_B = id(13);
    private static final UUID TEACHER_A = id(21), TEACHER_B = id(22), STUDENT_A = id(23), MULTI = id(24);
    private static final RSAKey KEY;
    private static final HttpServer JWKS;

    static {
        try {
            KEY = new RSAKeyGenerator(2048).keyID("integration-test").generate();
            JWKS = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            JWKS.createContext("/jwks", exchange -> {
                byte[] body = new JWKSet(KEY.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                try (var output = exchange.getResponseBody()) { output.write(body); }
            });
            JWKS.start();
        } catch (IOException | JOSEException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    @DynamicPropertySource
    static void authProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.security.oauth2.resourceserver.jwt.issuer-uri", () -> ISSUER);
        registry.add("spring.security.oauth2.resourceserver.jwt.jwk-set-uri",
            () -> "http://127.0.0.1:" + JWKS.getAddress().getPort() + "/jwks");
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void fixtures() {
        jdbc.update("DELETE FROM math_portal.school_directors");
        jdbc.update("DELETE FROM math_portal.director_accounts");
        jdbc.update("DELETE FROM auth.users");
        account(TEACHER_A, "teacher-a@example.com", true);
        account(TEACHER_B, "teacher-b@example.com", true);
        account(STUDENT_A, "student-a@example.com", true);
        account(id(41), "director-a@example.com", true);
        account(id(42), "director-b@example.com", true);
        account(id(43), "pending@example.com", false);
        jdbc.update("DELETE FROM math_portal.topics");
        jdbc.update("DELETE FROM math_portal.course_memberships");
        jdbc.update("DELETE FROM math_portal.school_memberships");
        jdbc.update("DELETE FROM math_portal.courses");
        jdbc.update("DELETE FROM math_portal.schools");
        jdbc.update("INSERT INTO math_portal.schools VALUES (?, ?), (?, ?)", SCHOOL_A, "Colegio A", SCHOOL_B, "Colegio B");
        jdbc.update("INSERT INTO math_portal.courses VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)",
            COURSE_A, SCHOOL_A, "Matematicas 1", COURSE_A2, SCHOOL_A, "Matematicas 2", COURSE_B, SCHOOL_B, "Algebra");
        member(SCHOOL_A, COURSE_A, TEACHER_A, "PROFESOR");
        member(SCHOOL_B, COURSE_B, TEACHER_B, "PROFESOR");
        member(SCHOOL_A, COURSE_A, STUDENT_A, "ALUMNO");
        member(SCHOOL_A, COURSE_A, MULTI, "PROFESOR");
        member(SCHOOL_B, COURSE_B, MULTI, "ALUMNO");
        jdbc.update("INSERT INTO math_portal.topics (id, school_id, course_id, title, content, created_by) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)",
            id(31), SCHOOL_A, COURSE_A, "Fracciones", "Contenido A", TEACHER_A,
            id(32), SCHOOL_B, COURSE_B, "Ecuaciones", "Contenido B", TEACHER_B);
    }

    @Test
    void anonymousCannotReadOrWriteButHealthIsPublic() throws Exception {
        mvc.perform(get("/api/schools").contextPath("/api")).andExpect(status().isUnauthorized());
        mvc.perform(post(path(SCHOOL_A, COURSE_A)).contextPath("/api")
            .contentType("application/json").content(topic())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/actuator/health").contextPath("/api")).andExpect(status().isOk());
    }

    @Test
    void teacherOnlyListsOwnSchoolAndAssignedCourses() throws Exception {
        mvc.perform(get("/api/schools").contextPath("/api").header("Authorization", token(TEACHER_A)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(SCHOOL_A.toString()))
            .andExpect(jsonPath("$[0].role").value("PROFESOR"));
        mvc.perform(get("/api/schools/" + SCHOOL_A + "/courses").contextPath("/api")
            .header("Authorization", token(TEACHER_A)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(COURSE_A.toString()));
    }

    @Test
    void assignedTeacherCreatesTopicWithServerSelectedOwner() throws Exception {
        mvc.perform(post(path(SCHOOL_A, COURSE_A)).contextPath("/api")
            .header("Authorization", token(TEACHER_A)).contentType("application/json").content(topic()))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("Decimales"))
            .andExpect(jsonPath("$.schoolId").value(SCHOOL_A.toString()))
            .andExpect(jsonPath("$.courseId").value(COURSE_A.toString()))
            .andExpect(jsonPath("$.createdBy").value(TEACHER_A.toString()));
        assertThat(topicCount()).isEqualTo(3);
    }

    @Test
    void teacherCannotReadOrWriteAnotherSchoolOrAnUnassignedCourse() throws Exception {
        for (UUID[] target : new UUID[][] {{SCHOOL_B, COURSE_B}, {SCHOOL_A, COURSE_A2}, {SCHOOL_A, COURSE_B}}) {
            mvc.perform(get(path(target[0], target[1])).contextPath("/api")
                .header("Authorization", token(TEACHER_A))).andExpect(status().isNotFound());
            mvc.perform(post(path(target[0], target[1])).contextPath("/api")
                .header("Authorization", token(TEACHER_A)).contentType("application/json").content(topic()))
                .andExpect(status().isNotFound());
        }
        mvc.perform(get("/api/schools/" + SCHOOL_B + "/courses").contextPath("/api")
            .header("Authorization", token(TEACHER_A))).andExpect(status().isNotFound());
        assertThat(topicCount()).isEqualTo(2);
    }

    @Test
    void studentCanReadEnrolledCourseButCannotCreateEvenWithTeacherJwtClaim() throws Exception {
        mvc.perform(get(path(SCHOOL_A, COURSE_A)).contextPath("/api").header("Authorization", token(STUDENT_A)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].title").value("Fracciones"));
        mvc.perform(post(path(SCHOOL_A, COURSE_A)).contextPath("/api")
            .header("Authorization", signed(STUDENT_A.toString(), ISSUER, "authenticated", Instant.now().plusSeconds(600), "PROFESOR", KEY))
            .contentType("application/json").content(topic())).andExpect(status().isForbidden());
        mvc.perform(get(path(SCHOOL_A, COURSE_A2)).contextPath("/api")
            .header("Authorization", token(STUDENT_A))).andExpect(status().isNotFound());
        mvc.perform(get(path(SCHOOL_B, COURSE_B)).contextPath("/api")
            .header("Authorization", token(STUDENT_A))).andExpect(status().isNotFound());
        assertThat(topicCount()).isEqualTo(2);
    }

    @Test
    void rolesAreScopedToEachSchool() throws Exception {
        mvc.perform(post(path(SCHOOL_A, COURSE_A)).contextPath("/api")
            .header("Authorization", token(MULTI)).contentType("application/json").content(topic()))
            .andExpect(status().isCreated());
        mvc.perform(post(path(SCHOOL_B, COURSE_B)).contextPath("/api")
            .header("Authorization", token(MULTI)).contentType("application/json").content(topic()))
            .andExpect(status().isForbidden());
    }

    @Test
    void revokingMembershipImmediatelyRevokesAccessForExistingToken() throws Exception {
        String bearer = token(TEACHER_A);
        jdbc.update("DELETE FROM math_portal.school_memberships WHERE school_id = ? AND user_id = ?", SCHOOL_A, TEACHER_A);
        mvc.perform(get(path(SCHOOL_A, COURSE_A)).contextPath("/api").header("Authorization", bearer))
            .andExpect(status().isNotFound());
        mvc.perform(post(path(SCHOOL_A, COURSE_A)).contextPath("/api").header("Authorization", bearer)
            .contentType("application/json").content(topic())).andExpect(status().isNotFound());
    }

    @Test
    void requestCannotOverrideSchoolRoleOrOwnerAndBlankContentIsRejected() throws Exception {
        for (String body : new String[] {
            "{\"title\":\"Tema\",\"content\":\"Texto\",\"role\":\"PROFESOR\"}",
            "{\"title\":\"Tema\",\"content\":\"Texto\",\"schoolId\":\"" + SCHOOL_B + "\"}",
            "{\"title\":\"Tema\",\"content\":\"Texto\",\"createdBy\":\"" + TEACHER_B + "\"}",
            "{\"title\":\"   \",\"content\":\"Texto\"}"
        }) {
            mvc.perform(post(path(SCHOOL_A, COURSE_A)).contextPath("/api")
                .header("Authorization", token(TEACHER_A)).contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
        }
        assertThat(topicCount()).isEqualTo(2);
    }

    @Test
    void invalidSignatureIssuerAudienceSubjectAndExpirationAreRejected() throws Exception {
        String subject = TEACHER_A.toString();
        Instant later = Instant.now().plusSeconds(600);
        for (String bearer : new String[] {
            "Bearer not-a-jwt",
            signed(subject, "https://other.example/auth/v1", "authenticated", later, "authenticated", KEY),
            signed(subject, ISSUER, "another-audience", later, "authenticated", KEY),
            signed(subject, ISSUER, "authenticated", Instant.now().minusSeconds(600), "authenticated", KEY),
            signed("not-a-user-id", ISSUER, "authenticated", later, "authenticated", KEY),
            signed(subject, ISSUER, "authenticated", later, "authenticated", new RSAKeyGenerator(2048).keyID("integration-test").generate()),
            signed(subject, ISSUER, "authenticated", null, "authenticated", KEY)
        }) {
            mvc.perform(get("/api/schools").contextPath("/api").header("Authorization", bearer))
                .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void databaseRejectsCrossSchoolAssignmentAndRoleEscalation() {
        assertThatThrownBy(() -> jdbc.update("INSERT INTO math_portal.course_memberships VALUES (?, ?, ?, ?)",
            SCHOOL_A, COURSE_B, TEACHER_A, "PROFESOR")).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO math_portal.course_memberships VALUES (?, ?, ?, ?)",
            SCHOOL_A, COURSE_A2, STUDENT_A, "PROFESOR")).isInstanceOf(DataIntegrityViolationException.class);
    }

    private void member(UUID school, UUID course, UUID user, String role) {
        jdbc.update("INSERT INTO math_portal.school_memberships VALUES (?, ?, ?)", school, user, role);
        jdbc.update("INSERT INTO math_portal.course_memberships VALUES (?, ?, ?, ?)", school, course, user, role);
    }

    private int topicCount() { return jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.topics", Integer.class); }
    private static UUID id(int value) { return UUID.fromString("00000000-0000-4000-8000-" + String.format("%012d", value)); }
    private String path(UUID school, UUID course) { return "/api/schools/" + school + "/courses/" + course + "/topics"; }
    private String topic() { return "{\"title\":\"Decimales\",\"content\":\"Repaso de decimales\"}"; }
    private String token(UUID user) throws JOSEException {
        return signed(user.toString(), ISSUER, "authenticated", Instant.now().plusSeconds(600), "authenticated", KEY);
    }

    private String signed(String subject, String issuer, String audience, Instant expiration, String role, RSAKey key) throws JOSEException {
        var claims = new JWTClaimsSet.Builder().subject(subject).issuer(issuer).audience(audience)
            .issueTime(Date.from(Instant.now().minusSeconds(30))).claim("role", role);
        if (expiration != null) claims.expirationTime(Date.from(expiration));
        var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("integration-test").build(), claims.build());
        jwt.sign(new RSASSASigner(key));
        return "Bearer " + jwt.serialize();
    }

    @Test
    void directorRegistrationRequiresConfirmedEmailInAuthDatabase() throws Exception {
        mvc.perform(post("/api/directors/register").contextPath("/api").contentType("application/json")
            .content("{\"name\":\"Directora\"}")).andExpect(status().isUnauthorized());
        for (UUID user : new UUID[] {id(43), id(99)}) {
            mvc.perform(post("/api/directors/register").contextPath("/api").header("Authorization", token(user))
                .contentType("application/json").content("{\"name\":\"Directora\"}"))
                .andExpect(status().isForbidden());
        }
        for (int request = 0; request < 2; request++) {
            mvc.perform(post("/api/directors/register").contextPath("/api").header("Authorization", token(id(41)))
                .contentType("application/json").content("{\"name\":\"Directora A\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("director-a@example.com"));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.director_accounts", Integer.class)).isEqualTo(1);
    }

    @Test
    void onlyRegisteredDirectorCreatesSchoolAndBecomesItsOwner() throws Exception {
        mvc.perform(post("/api/schools").contextPath("/api").header("Authorization", token(TEACHER_A))
            .contentType("application/json").content("{\"name\":\"Colegio nuevo\"}"))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/directors/register").contextPath("/api").header("Authorization", token(id(41)))
            .contentType("application/json").content("{\"name\":\"Directora A\"}"))
            .andExpect(status().isOk());
        mvc.perform(post("/api/schools").contextPath("/api").header("Authorization", token(id(41)))
            .contentType("application/json").content("{\"name\":\"Colegio nuevo\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("DIRECTOR"));
        mvc.perform(get("/api/schools").contextPath("/api").header("Authorization", token(id(41))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].name").value("Colegio nuevo"));
    }

    @Test
    void directorCanSeeAllOwnCoursesAndOnlyOwnStatistics() throws Exception {
        owner(id(41), SCHOOL_A);
        owner(id(42), SCHOOL_B);
        mvc.perform(get("/api/schools/" + SCHOOL_A + "/courses").contextPath("/api").header("Authorization", token(id(41))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/schools/" + SCHOOL_A + "/statistics").contextPath("/api").header("Authorization", token(id(41))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.professors").value(2))
            .andExpect(jsonPath("$.students").value(1)).andExpect(jsonPath("$.courses").value(2))
            .andExpect(jsonPath("$.topics").value(1));
        mvc.perform(get(path(SCHOOL_A, COURSE_A)).contextPath("/api").header("Authorization", token(id(41))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        for (UUID actor : new UUID[] {id(42), TEACHER_A, STUDENT_A}) {
            mvc.perform(get("/api/schools/" + SCHOOL_A + "/statistics").contextPath("/api")
                .header("Authorization", token(actor))).andExpect(status().isNotFound());
        }
    }

    @Test
    void directorAdministrationNeverCrossesSchoolBoundary() throws Exception {
        owner(id(41), SCHOOL_A);
        String bearer = token(id(41));
        mvc.perform(get("/api/schools/" + SCHOOL_B + "/members").contextPath("/api").header("Authorization", bearer))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/schools/" + SCHOOL_B + "/courses").contextPath("/api").header("Authorization", bearer)
            .contentType("application/json").content("{\"name\":\"No autorizado\"}"))
            .andExpect(status().isNotFound());
        mvc.perform(delete("/api/schools/" + SCHOOL_A + "/courses/" + COURSE_B).contextPath("/api").header("Authorization", bearer))
            .andExpect(status().isNotFound());
        mvc.perform(delete("/api/schools/" + SCHOOL_B + "/members/" + TEACHER_B).contextPath("/api").header("Authorization", bearer))
            .andExpect(status().isNotFound());
        mvc.perform(put("/api/schools/" + SCHOOL_A + "/courses/" + COURSE_B + "/members/" + STUDENT_A)
            .contextPath("/api").header("Authorization", bearer)).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.courses", Integer.class)).isEqualTo(3);
    }

    @Test
    void directorAddsVerifiedTeacherByEmailAndAssignsThemToOwnCourse() throws Exception {
        owner(id(41), SCHOOL_A);
        String bearer = token(id(41));
        mvc.perform(post("/api/schools/" + SCHOOL_A + "/members").contextPath("/api").header("Authorization", bearer)
            .contentType("application/json").content("{\"email\":\"TEACHER-B@EXAMPLE.COM\",\"role\":\"PROFESOR\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.userId").value(TEACHER_B.toString()));
        mvc.perform(put("/api/schools/" + SCHOOL_A + "/courses/" + COURSE_A + "/members/" + TEACHER_B)
            .contextPath("/api").header("Authorization", bearer)).andExpect(status().isNoContent());
        mvc.perform(post(path(SCHOOL_A, COURSE_A)).contextPath("/api").header("Authorization", token(TEACHER_B))
            .contentType("application/json").content(topic())).andExpect(status().isCreated());
        // Removing the teacher from A must retain their existing membership in B.
        mvc.perform(delete("/api/schools/" + SCHOOL_A + "/members/" + TEACHER_B).contextPath("/api").header("Authorization", bearer))
            .andExpect(status().isNoContent());
        mvc.perform(get(path(SCHOOL_A, COURSE_A)).contextPath("/api").header("Authorization", token(TEACHER_B)))
            .andExpect(status().isNotFound());
        mvc.perform(get(path(SCHOOL_B, COURSE_B)).contextPath("/api").header("Authorization", token(TEACHER_B)))
            .andExpect(status().isOk());
    }

    @Test
    void cannotAssignDirectorRoleUnconfirmedAccountOrOverrideExistingRole() throws Exception {
        owner(id(41), SCHOOL_A);
        String bearer = token(id(41));
        mvc.perform(post("/api/schools/" + SCHOOL_A + "/members").contextPath("/api").header("Authorization", bearer)
            .contentType("application/json").content("{\"email\":\"student-a@example.com\",\"role\":\"DIRECTOR\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/schools/" + SCHOOL_A + "/members").contextPath("/api").header("Authorization", bearer)
            .contentType("application/json").content("{\"email\":\"student-a@example.com\",\"role\":\"PROFESOR\"}"))
            .andExpect(status().isConflict());
        mvc.perform(post("/api/schools/" + SCHOOL_A + "/members").contextPath("/api").header("Authorization", bearer)
            .contentType("application/json").content("{\"email\":\"pending@example.com\",\"role\":\"ALUMNO\"}"))
            .andExpect(status().isNotFound());
        mvc.perform(put("/api/schools/" + SCHOOL_A + "/courses/" + COURSE_A2 + "/members/" + STUDENT_A)
            .contextPath("/api").header("Authorization", bearer).contentType("application/json").content("{\"role\":\"PROFESOR\"}"))
            .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT role FROM math_portal.course_memberships WHERE course_id = ? AND user_id = ?", String.class, COURSE_A2, STUDENT_A)).isEqualTo("ALUMNO");
    }

    @Test
    void directorCreatesAndDeletesCourseWithTopicsAndAssignments() throws Exception {
        owner(id(41), SCHOOL_A);
        String bearer = token(id(41));
        mvc.perform(post("/api/schools/" + SCHOOL_A + "/courses").contextPath("/api").header("Authorization", bearer)
            .contentType("application/json").content("{\"name\":\"Geometria\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.schoolId").value(SCHOOL_A.toString()));
        mvc.perform(delete("/api/schools/" + SCHOOL_A + "/courses/" + COURSE_A).contextPath("/api").header("Authorization", bearer))
            .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.topics WHERE school_id = ?", Integer.class, SCHOOL_A)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.course_memberships WHERE course_id = ?", Integer.class, COURSE_A)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.topics WHERE school_id = ?", Integer.class, SCHOOL_B)).isEqualTo(1);
    }

    @Test
    void removingStudentPreservesAuthAccountAndOtherSchool() throws Exception {
        owner(id(41), SCHOOL_A);
        member(SCHOOL_B, COURSE_B, STUDENT_A, "ALUMNO");
        mvc.perform(delete("/api/schools/" + SCHOOL_A + "/members/" + STUDENT_A).contextPath("/api")
            .header("Authorization", token(id(41)))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM auth.users WHERE id = ?", Integer.class, STUDENT_A)).isEqualTo(1);
        mvc.perform(get(path(SCHOOL_B, COURSE_B)).contextPath("/api").header("Authorization", token(STUDENT_A)))
            .andExpect(status().isOk());
        mvc.perform(get(path(SCHOOL_A, COURSE_A)).contextPath("/api").header("Authorization", token(STUDENT_A)))
            .andExpect(status().isNotFound());
    }

    @Test
    void unconfirmedDirectorCannotAdministerEvenWithExistingOwnership() throws Exception {
        owner(id(41), SCHOOL_A);
        jdbc.update("UPDATE auth.users SET email_confirmed_at = NULL WHERE id = ?", id(41));
        mvc.perform(get("/api/schools/" + SCHOOL_A + "/statistics").contextPath("/api").header("Authorization", token(id(41))))
            .andExpect(status().isForbidden());
    }

private void owner(UUID user, UUID school) {
        jdbc.update("INSERT INTO math_portal.director_accounts (user_id, name) VALUES (?, ?)", user, "Director");
        jdbc.update("INSERT INTO math_portal.school_directors VALUES (?, ?)", school, user);
    }
    private void account(UUID user, String email, boolean verified) {
        jdbc.update("INSERT INTO auth.users VALUES (?, ?, ?)", user, email,
            verified ? java.time.OffsetDateTime.now() : null);
    }

    @AfterAll
    static void stopJwks() { JWKS.stop(0); }
}
