package com.hackathon.mathportal.modules.studentaccounts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.UUID;
import com.hackathon.mathportal.modules.studentaccounts.StudentAccountTestConfig.FakeSupabaseAdminClient;
import com.jayway.jsonpath.JsonPath;
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
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:studentaccounts;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=none"
})
@AutoConfigureMockMvc
@Import(StudentAccountTestConfig.class)
class StudentAccountIntegrationTest {
    private static final String ISSUER = "https://test-project.supabase.co/auth/v1";
    private static final UUID SCHOOL_A = id(1), SCHOOL_B = id(2);
    private static final UUID TEACHER_A = id(21), TEACHER_C = id(22), STUDENT_A = id(23);
    private static final UUID DIRECTOR_A = id(41), DIRECTOR_B = id(42);
    private static final UUID ROOM_A = id(61), ROOM_C = id(62), ROOM_B = id(63);
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
    @Autowired FakeSupabaseAdminClient supabase;

    @BeforeEach
    void fixtures() {
        supabase.reset();
        jdbc.update("DELETE FROM math_portal.alumnos");
        jdbc.update("DELETE FROM math_portal.classroom_students");
        jdbc.update("DELETE FROM math_portal.classrooms");
        jdbc.update("DELETE FROM math_portal.school_directors");
        jdbc.update("DELETE FROM math_portal.director_accounts");
        jdbc.update("DELETE FROM math_portal.school_memberships");
        jdbc.update("DELETE FROM math_portal.schools");
        jdbc.update("DELETE FROM auth.users");
        for (UUID user : new UUID[] {TEACHER_A, TEACHER_C, STUDENT_A, DIRECTOR_A, DIRECTOR_B}) {
            jdbc.update("INSERT INTO auth.users VALUES (?, ?, ?)", user, user + "@example.com", OffsetDateTime.now());
        }
        jdbc.update("INSERT INTO math_portal.schools VALUES (?, ?), (?, ?)", SCHOOL_A, "Escuela A", SCHOOL_B, "Escuela B");
        owner(DIRECTOR_A, SCHOOL_A);
        owner(DIRECTOR_B, SCHOOL_B);
        member(SCHOOL_A, TEACHER_A, "PROFESOR");
        member(SCHOOL_A, TEACHER_C, "PROFESOR");
        member(SCHOOL_A, STUDENT_A, "ALUMNO");
        member(SCHOOL_B, TEACHER_C, "PROFESOR");
        room(ROOM_A, SCHOOL_A, TEACHER_A, "CUARTO PRIMARIA");
        room(ROOM_C, SCHOOL_A, TEACHER_C, "QUINTO PRIMARIA");
        room(ROOM_B, SCHOOL_B, TEACHER_C, "SEXTO PRIMARIA");
        jdbc.update("INSERT INTO math_portal.classroom_students (school_id, classroom_id, academic_year, student_id) VALUES (?, ?, 2026, ?)",
            SCHOOL_A, ROOM_A, STUDENT_A);
    }

    @Test
    void directorCreatesAccountWithMembershipEnrollmentAndProfile() throws Exception {
        String body = create(DIRECTOR_A, SCHOOL_A, ROOM_A, account("Juan.Perez_2", "secreto1", "  Juanito "))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.username").value("juan.perez_2"))
            .andExpect(jsonPath("$.alias").value("Juanito")).andExpect(jsonPath("$.classroomId").value(ROOM_A.toString()))
            .andReturn().getResponse().getContentAsString();
        UUID student = UUID.fromString(JsonPath.read(body, "$.studentId"));

        assertThat(supabase.createdEmails).containsExactly("juan.perez_2@alumnos.mayamente.app");
        assertThat(supabase.passwords.get(student)).isEqualTo("secreto1");
        assertThat(jdbc.queryForObject("SELECT role FROM math_portal.school_memberships WHERE school_id = ? AND user_id = ?",
            String.class, SCHOOL_A, student)).isEqualTo("ALUMNO");
        assertThat(jdbc.queryForObject("SELECT academic_year FROM math_portal.classroom_students WHERE classroom_id = ? AND student_id = ?",
            Integer.class, ROOM_A, student)).isEqualTo(2026);
        var profile = jdbc.queryForMap("SELECT alias, grado_escolar, zona_horaria, estado, participa_ranking FROM math_portal.alumnos WHERE auth_subject = ?",
            student.toString());
        assertThat(profile.get("alias")).isEqualTo("Juanito");
        assertThat(profile.get("grado_escolar")).isEqualTo("CUARTO PRIMARIA");
        assertThat(profile.get("zona_horaria")).isEqualTo("America/Guatemala");
        assertThat(profile.get("estado")).isEqualTo("ACTIVO");
        assertThat(profile.get("participa_ranking")).isEqualTo(false);
        assertThat(supabase.deleted).isEmpty();
    }

    @Test
    void responsibleTeacherCreatesAccountForOwnClassroom() throws Exception {
        create(TEACHER_A, SCHOOL_A, ROOM_A, account("maria", "secreto1", "María"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.username").value("maria"));
        mvc.perform(get("/api/schools/" + SCHOOL_A + "/classrooms/" + ROOM_A + "/students").contextPath("/api")
            .header("Authorization", token(TEACHER_A)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void otherTeacherStudentOtherDirectorAndForeignClassroomAreRejected() throws Exception {
        for (UUID actor : new UUID[] {TEACHER_C, STUDENT_A, DIRECTOR_B}) {
            create(actor, SCHOOL_A, ROOM_A, account("intruso", "secreto1", "Intruso")).andExpect(status().isNotFound());
        }
        create(DIRECTOR_A, SCHOOL_A, ROOM_B, account("intruso", "secreto1", "Intruso")).andExpect(status().isNotFound());
        create(TEACHER_C, SCHOOL_A, ROOM_B, account("intruso", "secreto1", "Intruso")).andExpect(status().isNotFound());
        mvc.perform(post(path(SCHOOL_A, ROOM_A)).contextPath("/api").contentType("application/json")
            .content(account("intruso", "secreto1", "Intruso"))).andExpect(status().isUnauthorized());
        jdbc.update("UPDATE auth.users SET email_confirmed_at = NULL WHERE id = ?", DIRECTOR_A);
        create(DIRECTOR_A, SCHOOL_A, ROOM_A, account("intruso", "secreto1", "Intruso")).andExpect(status().isForbidden());
        assertThat(supabase.createdEmails).isEmpty();
        assertThat(studentMemberships()).isEqualTo(1);
    }

    @Test
    void repeatedUsernameIsConflictAndLeavesDatabaseUntouched() throws Exception {
        create(DIRECTOR_A, SCHOOL_A, ROOM_A, account("pedro", "secreto1", "Pedro")).andExpect(status().isCreated());
        create(TEACHER_C, SCHOOL_A, ROOM_C, account("PEDRO", "secreto2", "Otro Pedro"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.detail").value("Ese usuario ya existe"));
        assertThat(studentMemberships()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.alumnos", Integer.class)).isEqualTo(1);
        assertThat(supabase.deleted).isEmpty();
    }

    @Test
    void databaseFailureRollsBackAndDeletesSupabaseUser() throws Exception {
        UUID user = UUID.randomUUID();
        supabase.nextId = user;
        // El perfil choca con la restricción única después de insertar membresía y matrícula.
        jdbc.update("INSERT INTO math_portal.alumnos (id, auth_subject, alias, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)",
            UUID.randomUUID(), user.toString(), "Previo", OffsetDateTime.now(), OffsetDateTime.now());
        create(DIRECTOR_A, SCHOOL_A, ROOM_A, account("lucia", "secreto1", "Lucía")).andExpect(status().isConflict());
        assertThat(supabase.deleted).containsExactly(user);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM auth.users WHERE id = ?", Integer.class, user)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.school_memberships WHERE user_id = ?", Integer.class, user)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.classroom_students WHERE student_id = ?", Integer.class, user)).isZero();
    }

    @Test
    void invalidAccountDataIsRejectedBeforeCallingSupabase() throws Exception {
        for (String body : new String[] {
            account("ab", "secreto1", "Ana"),
            account("juan perez", "secreto1", "Juan"),
            account("josé", "secreto1", "José"),
            account(".juan", "secreto1", "Juan"),
            account("juan..perez", "secreto1", "Juan"),
            account("a".repeat(31), "secreto1", "Juan"),
            account("juan", "12345", "Juan"),
            account("juan", "secreto1", "   "),
            account("juan", "secreto1", "a".repeat(41)),
            "{\"username\":\"juan\",\"password\":\"secreto1\",\"alias\":\"Juan\",\"role\":\"PROFESOR\"}"
        }) {
            create(DIRECTOR_A, SCHOOL_A, ROOM_A, body).andExpect(status().isBadRequest());
        }
        assertThat(supabase.createdEmails).isEmpty();
    }

    @Test
    void staffResetsPasswordOnlyForManagedAccountsOfTheClassroom() throws Exception {
        String body = create(DIRECTOR_A, SCHOOL_A, ROOM_A, account("sofia", "secreto1", "Sofía"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID student = UUID.fromString(JsonPath.read(body, "$.studentId"));
        String url = path(SCHOOL_A, ROOM_A) + "/" + student + "/password";

        mvc.perform(put(url).contextPath("/api").header("Authorization", token(TEACHER_A))
            .contentType("application/json").content("{\"password\":\"nueva123\"}")).andExpect(status().isNoContent());
        assertThat(supabase.passwords.get(student)).isEqualTo("nueva123");
        for (UUID actor : new UUID[] {TEACHER_C, STUDENT_A, DIRECTOR_B}) {
            mvc.perform(put(url).contextPath("/api").header("Authorization", token(actor))
                .contentType("application/json").content("{\"password\":\"robada1\"}")).andExpect(status().isNotFound());
        }
        mvc.perform(put(path(SCHOOL_A, ROOM_C) + "/" + student + "/password").contextPath("/api").header("Authorization", token(DIRECTOR_A))
            .contentType("application/json").content("{\"password\":\"robada1\"}")).andExpect(status().isNotFound());
        mvc.perform(put(path(SCHOOL_A, ROOM_A) + "/" + STUDENT_A + "/password").contextPath("/api").header("Authorization", token(DIRECTOR_A))
            .contentType("application/json").content("{\"password\":\"robada1\"}")).andExpect(status().isNotFound());
        mvc.perform(put(url).contextPath("/api").header("Authorization", token(DIRECTOR_A))
            .contentType("application/json").content("{\"password\":\"123\"}")).andExpect(status().isBadRequest());
        assertThat(supabase.passwords.get(student)).isEqualTo("nueva123");
        assertThat(supabase.passwords).doesNotContainKey(STUDENT_A);
    }

    private ResultActions create(UUID actor, UUID school, UUID classroom, String body) throws Exception {
        return mvc.perform(post(path(school, classroom)).contextPath("/api")
            .header("Authorization", token(actor)).contentType("application/json").content(body));
    }
    private int studentMemberships() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.school_memberships WHERE role = 'ALUMNO'", Integer.class);
    }
    private void owner(UUID user, UUID school) {
        jdbc.update("INSERT INTO math_portal.director_accounts (user_id, name) VALUES (?, ?)", user, "Director");
        jdbc.update("INSERT INTO math_portal.school_directors VALUES (?, ?)", school, user);
    }
    private void member(UUID school, UUID user, String role) {
        jdbc.update("INSERT INTO math_portal.school_memberships VALUES (?, ?, ?)", school, user, role);
    }
    private void room(UUID classroom, UUID school, UUID teacher, String grade) {
        jdbc.update("INSERT INTO math_portal.classrooms (id, school_id, teacher_id, grade, section, academic_year) VALUES (?, ?, ?, ?, 'A', 2026)",
            classroom, school, teacher, grade);
    }
    private static String account(String username, String password, String alias) {
        return "{\"username\":\"" + username + "\",\"password\":\"" + password + "\",\"alias\":\"" + alias + "\"}";
    }
    private static String path(UUID school, UUID classroom) { return "/api/schools/" + school + "/classrooms/" + classroom + "/student-accounts"; }
    private static UUID id(int value) { return UUID.fromString("00000000-0000-4000-8000-" + String.format("%012d", value)); }

    private String token(UUID user) throws JOSEException {
        var claims = new JWTClaimsSet.Builder().subject(user.toString()).issuer(ISSUER).audience("authenticated")
            .issueTime(Date.from(Instant.now().minusSeconds(30))).expirationTime(Date.from(Instant.now().plusSeconds(600)))
            .claim("role", "authenticated").build();
        var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("integration-test").build(), claims);
        jwt.sign(new RSASSASigner(KEY));
        return "Bearer " + jwt.serialize();
    }

    @AfterAll
    static void stopJwks() { JWKS.stop(0); }
}
