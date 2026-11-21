package com.hackathon.mathportal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Cuentas creadas por el profesor, acceso del estudiante y permisos.
 * Supabase Auth se sustituye por un servidor HTTP local que imita su API.
 */
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:accounts;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=none",
    "mayamente.auth.anon-key=anon-test",
    "mayamente.auth.service-role-key=service-test",
    "mayamente.auth.student-email-domain=alumnos.test.invalid"
})
@AutoConfigureMockMvc
@Import(AccountsTestDatabaseConfig.class)
class StudentAccountsIntegrationTest {
    private static final String ISSUER = "https://test-project.supabase.co/auth/v1";
    private static final UUID SCHOOL_A = id(1), SCHOOL_B = id(2);
    private static final UUID COURSE_A = id(11), COURSE_A2 = id(12), COURSE_B = id(13), COURSE_A3 = id(14);
    private static final UUID TEACHER_A = id(21), TEACHER_B = id(22);
    private static final RSAKey KEY;
    private static final HttpServer SERVER;
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Usuarios del Supabase Auth simulado: correo → (id, contraseña). La API nunca ve este mapa. */
    record FakeUser(UUID id, String password) {}
    static final Map<String, FakeUser> USERS = new ConcurrentHashMap<>();

    static {
        try {
            KEY = new RSAKeyGenerator(2048).keyID("accounts-test").generate();
            SERVER = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            SERVER.createContext("/jwks", ex -> send(ex, 200, new JWKSet(KEY.toPublicJWK()).toString()));
            SERVER.createContext("/auth/v1/token", StudentAccountsIntegrationTest::token);
            SERVER.createContext("/auth/v1/logout", ex -> send(ex, 204, ""));
            SERVER.createContext("/auth/v1/admin/users", StudentAccountsIntegrationTest::admin);
            SERVER.start();
        } catch (IOException | JOSEException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        String base = "http://127.0.0.1:" + SERVER.getAddress().getPort();
        registry.add("spring.security.oauth2.resourceserver.jwt.issuer-uri", () -> ISSUER);
        registry.add("spring.security.oauth2.resourceserver.jwt.jwk-set-uri", () -> base + "/jwks");
        registry.add("mayamente.auth.supabase-url", () -> base);
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void fixtures() {
        USERS.clear();
        jdbc.update("DELETE FROM math_portal.student_accounts");
        jdbc.update("DELETE FROM math_portal.alumnos");
        jdbc.update("DELETE FROM math_portal.course_memberships");
        jdbc.update("DELETE FROM math_portal.school_memberships");
        jdbc.update("DELETE FROM math_portal.courses");
        jdbc.update("DELETE FROM math_portal.schools");
        jdbc.update("INSERT INTO math_portal.schools VALUES (?, ?), (?, ?)", SCHOOL_A, "Escuela Tikal", SCHOOL_B, "Escuela Yaxhá");
        jdbc.update("INSERT INTO math_portal.courses VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)",
            COURSE_A, SCHOOL_A, "4to B", COURSE_A2, SCHOOL_A, "5to A", COURSE_B, SCHOOL_B, "4to A", COURSE_A3, SCHOOL_A, "6to C");
        member(SCHOOL_A, COURSE_A, TEACHER_A);
        member(SCHOOL_A, COURSE_A2, TEACHER_A);
        member(SCHOOL_B, COURSE_B, TEACHER_B);
    }

    @Test
    void teacherCreatesAccountAndStudentEntersStraightToThatClass() throws Exception {
        mvc.perform(api(get("/api/teacher/classes")).header("Authorization", bearer(TEACHER_A)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));

        var created = createStudent(TEACHER_A, COURSE_A, "Daniel García", "Daniel.G", "tikal123")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.username").value("Daniel.G"))
            .andExpect(jsonPath("$.courseId").value(COURSE_A.toString()))
            .andExpect(jsonPath("$.password").doesNotExist())
            .andReturn();
        UUID studentId = UUID.fromString(JSON.readTree(created.getResponse().getContentAsString()).path("userId").asText());

        String access = login("daniel.g", "tikal123");  // el usuario no distingue mayúsculas
        mvc.perform(api(get("/api/students/me/class")).header("Authorization", "Bearer " + access))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.userId").value(studentId.toString()))
            .andExpect(jsonPath("$.displayName").value("Daniel García"))
            .andExpect(jsonPath("$.courseId").value(COURSE_A.toString()))
            .andExpect(jsonPath("$.courseName").value("4to B"))
            .andExpect(jsonPath("$.schoolName").value("Escuela Tikal"));

        // La contraseña no aparece en ninguna tabla de la API
        for (String table : new String[] {"student_accounts", "alumnos", "course_memberships", "school_memberships"}) {
            var rows = jdbc.queryForList("SELECT * FROM math_portal." + table);
            assertThat(rows.toString()).doesNotContain("tikal123");
        }
        mvc.perform(api(get("/api/teacher/classes/" + COURSE_A + "/students")).header("Authorization", bearer(TEACHER_A)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].username").value("Daniel.G"))
            .andExpect(jsonPath("$[0].password").doesNotExist());
    }

    @Test
    void wrongPasswordAndUnknownUserGetTheSameRejection() throws Exception {
        createStudent(TEACHER_A, COURSE_A, "Ana", "ana", "secreto1").andExpect(status().isCreated());
        for (String[] attempt : new String[][] {{"ana", "otra-clave"}, {"nadie", "secreto1"}, {"ana@x.com", "secreto1"}}) {
            mvc.perform(api(post("/api/auth/student/login")).contentType("application/json")
                    .content(JSON.writeValueAsString(Map.of("username", attempt[0], "password", attempt[1]))))
                .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void repeatedFailuresLockTheUsernameForAWhile() throws Exception {
        createStudent(TEACHER_A, COURSE_A, "Bea", "bea", "secreto1").andExpect(status().isCreated());
        for (int i = 0; i < 5; i++) {
            mvc.perform(api(post("/api/auth/student/login")).contentType("application/json")
                .content("{\"username\":\"bea\",\"password\":\"mal-" + i + "\"}")).andExpect(status().isUnauthorized());
        }
        mvc.perform(api(post("/api/auth/student/login")).contentType("application/json")
            .content("{\"username\":\"bea\",\"password\":\"secreto1\"}")).andExpect(status().isTooManyRequests());
    }

    @Test
    void teacherOnlyManagesOwnClassesAndStudents() throws Exception {
        var created = createStudent(TEACHER_A, COURSE_A, "Luis", "luis", "luis1234").andExpect(status().isCreated()).andReturn();
        UUID luis = UUID.fromString(JSON.readTree(created.getResponse().getContentAsString()).path("userId").asText());

        // Otro profesor, otro colegio
        createStudent(TEACHER_B, COURSE_A, "Intruso", "intruso", "intruso1").andExpect(status().isNotFound());
        mvc.perform(api(get("/api/teacher/classes/" + COURSE_A + "/students")).header("Authorization", bearer(TEACHER_B)))
            .andExpect(status().isNotFound());
        mvc.perform(api(put("/api/teacher/students/" + luis + "/password")).header("Authorization", bearer(TEACHER_B))
            .contentType("application/json").content("{\"password\":\"robada99\"}")).andExpect(status().isNotFound());
        // Un curso del mismo colegio sin asignación tampoco
        createStudent(TEACHER_A, COURSE_A3, "Eva", "eva", "eva12345").andExpect(status().isNotFound());
        // El estudiante no administra cuentas
        String access = login("luis", "luis1234");
        mvc.perform(api(get("/api/teacher/classes/" + COURSE_A + "/students")).header("Authorization", "Bearer " + access))
            .andExpect(status().isNotFound());
        mvc.perform(api(get("/api/teacher/classes")).header("Authorization", "Bearer " + access))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        // Sin token
        mvc.perform(api(get("/api/teacher/classes"))).andExpect(status().isUnauthorized());
        mvc.perform(api(get("/api/students/me/class"))).andExpect(status().isUnauthorized());
        // Un profesor no tiene "clase de estudiante"
        mvc.perform(api(get("/api/students/me/class")).header("Authorization", bearer(TEACHER_A))).andExpect(status().isNotFound());
    }

    @Test
    void usernamesAreUniqueIgnoringCase() throws Exception {
        createStudent(TEACHER_A, COURSE_A, "Ana", "Ana.P", "secreto1").andExpect(status().isCreated());
        createStudent(TEACHER_B, COURSE_B, "Ana", "ana.p", "secreto2").andExpect(status().isConflict());
        createStudent(TEACHER_A, COURSE_A, "Bad", "no válido!", "secreto2").andExpect(status().isBadRequest());
        createStudent(TEACHER_A, COURSE_A, "Corta", "corta", "123").andExpect(status().isBadRequest());
    }

    @Test
    void resetReplacesThePasswordWithoutRevealingTheOldOne() throws Exception {
        var created = createStudent(TEACHER_A, COURSE_A, "Sofía", "sofia", "inicial1").andExpect(status().isCreated()).andReturn();
        UUID sofia = UUID.fromString(JSON.readTree(created.getResponse().getContentAsString()).path("userId").asText());
        mvc.perform(api(put("/api/teacher/students/" + sofia + "/password")).header("Authorization", bearer(TEACHER_A))
            .contentType("application/json").content("{\"password\":\"nueva123\"}")).andExpect(status().isNoContent());
        mvc.perform(api(post("/api/auth/student/login")).contentType("application/json")
            .content("{\"username\":\"sofia\",\"password\":\"inicial1\"}")).andExpect(status().isUnauthorized());
        login("sofia", "nueva123");
        mvc.perform(api(get("/api/teacher/classes/" + COURSE_A + "/students")).header("Authorization", bearer(TEACHER_A)))
            .andExpect(jsonPath("$[0].passwordResetAt").isNotEmpty())
            .andExpect(jsonPath("$[0].password").doesNotExist());
    }

    @Test
    void teacherMovesStudentBetweenOwnClasses() throws Exception {
        var created = createStudent(TEACHER_A, COURSE_A, "Mateo", "mateo", "mateo123").andExpect(status().isCreated()).andReturn();
        UUID mateo = UUID.fromString(JSON.readTree(created.getResponse().getContentAsString()).path("userId").asText());
        String body = "{\"courseId\":\"" + COURSE_A2 + "\"}";
        mvc.perform(api(put("/api/teacher/students/" + mateo + "/class")).header("Authorization", bearer(TEACHER_A))
            .contentType("application/json").content(body)).andExpect(status().isNoContent());
        String access = login("mateo", "mateo123");
        mvc.perform(api(get("/api/students/me/class")).header("Authorization", "Bearer " + access))
            .andExpect(jsonPath("$.courseName").value("5to A"));
        // No puede moverlo a un curso que no enseña
        mvc.perform(api(put("/api/teacher/students/" + mateo + "/class")).header("Authorization", bearer(TEACHER_A))
            .contentType("application/json").content("{\"courseId\":\"" + COURSE_B + "\"}")).andExpect(status().isNotFound());
    }

    @Test
    void genderIsSavedOnTheStudentProfileAndReturnedWithTheClass() throws Exception {
        createStudent(TEACHER_A, COURSE_A, "Rosa", "rosa", "rosa1234").andExpect(status().isCreated());
        String access = login("rosa", "rosa1234");
        mvc.perform(api(patch("/api/students/me")).header("Authorization", "Bearer " + access)
            .contentType("application/json").content("{\"gender\":\"NINA\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.gender").value("NINA"));
        mvc.perform(api(get("/api/students/me/class")).header("Authorization", "Bearer " + access))
            .andExpect(jsonPath("$.gender").value("NINA"));
        mvc.perform(api(patch("/api/students/me")).header("Authorization", "Bearer " + access)
            .contentType("application/json").content("{\"gender\":\"OTRO\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void refreshAndLogout() throws Exception {
        createStudent(TEACHER_A, COURSE_A, "Leo", "leo", "leo12345").andExpect(status().isCreated());
        var session = JSON.readTree(mvc.perform(api(post("/api/auth/student/login")).contentType("application/json")
            .content("{\"username\":\"leo\",\"password\":\"leo12345\"}")).andReturn().getResponse().getContentAsString());
        mvc.perform(api(post("/api/auth/refresh")).contentType("application/json")
                .content("{\"refreshToken\":\"" + session.path("refreshToken").asText() + "\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isNotEmpty());
        mvc.perform(api(post("/api/auth/refresh")).contentType("application/json").content("{\"refreshToken\":\"inventado\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(api(post("/api/auth/logout")).header("Authorization", "Bearer " + session.path("accessToken").asText()))
            .andExpect(status().isNoContent());
    }

    // ---------- utilidades ----------

    private org.springframework.test.web.servlet.ResultActions createStudent(UUID teacher, UUID course, String name,
            String username, String password) throws Exception {
        return mvc.perform(api(post("/api/teacher/classes/" + course + "/students")).header("Authorization", bearer(teacher))
            .contentType("application/json")
            .content(JSON.writeValueAsString(Map.of("displayName", name, "username", username, "password", password))));
    }

    private String login(String username, String password) throws Exception {
        var result = mvc.perform(api(post("/api/auth/student/login")).contentType("application/json")
                .content(JSON.writeValueAsString(Map.of("username", username, "password", password))))
            .andExpect(status().isOk()).andReturn();
        return JSON.readTree(result.getResponse().getContentAsString()).path("accessToken").asText();
    }

    private static MockHttpServletRequestBuilder api(MockHttpServletRequestBuilder builder) { return builder.contextPath("/api"); }

    private void member(UUID school, UUID course, UUID user) {
        jdbc.update("MERGE INTO math_portal.school_memberships (school_id, user_id, role) KEY (school_id, user_id) VALUES (?, ?, 'PROFESOR')", school, user);
        jdbc.update("INSERT INTO math_portal.course_memberships VALUES (?, ?, ?, 'PROFESOR')", school, course, user);
    }

    private static UUID id(int value) { return UUID.fromString("00000000-0000-4000-8000-" + String.format("%012d", value)); }

    private static String bearer(UUID user) throws JOSEException { return "Bearer " + jwt(user); }

    private static String jwt(UUID user) throws JOSEException {
        var claims = new JWTClaimsSet.Builder().subject(user.toString()).issuer(ISSUER).audience("authenticated")
            .issueTime(Date.from(Instant.now().minusSeconds(30))).expirationTime(Date.from(Instant.now().plusSeconds(600)))
            .claim("role", "authenticated").build();
        var signed = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("accounts-test").build(), claims);
        signed.sign(new RSASSASigner(KEY));
        return signed.serialize();
    }

    // ---------- Supabase Auth simulado ----------

    private static void token(HttpExchange ex) throws IOException {
        if (!"anon-test".equals(ex.getRequestHeaders().getFirst("apikey"))) { send(ex, 401, "{}"); return; }
        JsonNode body = JSON.readTree(ex.getRequestBody());
        String query = ex.getRequestURI().getQuery();
        FakeUser user = null;
        if (query.contains("grant_type=password")) {
            FakeUser candidate = USERS.get(body.path("email").asText());
            if (candidate != null && candidate.password().equals(body.path("password").asText())) user = candidate;
        } else if (query.contains("grant_type=refresh_token")) {
            String refresh = body.path("refresh_token").asText();
            user = USERS.values().stream().filter(u -> ("r-" + u.id()).equals(refresh)).findFirst().orElse(null);
        }
        if (user == null) { send(ex, 400, "{\"error\":\"invalid_grant\"}"); return; }
        try {
            send(ex, 200, JSON.writeValueAsString(Map.of("access_token", jwt(user.id()), "refresh_token", "r-" + user.id(),
                "expires_in", 3600, "user", Map.of("id", user.id().toString()))));
        } catch (JOSEException e) {
            send(ex, 500, "{}");
        }
    }

    private static void admin(HttpExchange ex) throws IOException {
        boolean authorized = "service-test".equals(ex.getRequestHeaders().getFirst("apikey"))
            && "Bearer service-test".equals(ex.getRequestHeaders().getFirst("Authorization"));
        if (!authorized) { send(ex, 401, "{}"); return; }
        String path = ex.getRequestURI().getPath();
        switch (ex.getRequestMethod()) {
            case "POST" -> {
                JsonNode body = JSON.readTree(ex.getRequestBody());
                String email = body.path("email").asText();
                if (USERS.containsKey(email)) { send(ex, 422, "{\"msg\":\"email_exists\"}"); return; }
                assertThat(body.path("email_confirm").asBoolean()).isTrue();
                UUID id = UUID.randomUUID();
                USERS.put(email, new FakeUser(id, body.path("password").asText()));
                send(ex, 200, "{\"id\":\"" + id + "\"}");
            }
            case "PUT" -> {
                UUID id = UUID.fromString(path.substring(path.lastIndexOf('/') + 1));
                String password = JSON.readTree(ex.getRequestBody()).path("password").asText();
                USERS.replaceAll((email, u) -> u.id().equals(id) ? new FakeUser(id, password) : u);
                send(ex, 200, "{}");
            }
            case "DELETE" -> {
                UUID id = UUID.fromString(path.substring(path.lastIndexOf('/') + 1));
                USERS.values().removeIf(u -> u.id().equals(id));
                send(ex, 200, "{}");
            }
            default -> send(ex, 405, "{}");
        }
    }

    private static void send(HttpExchange ex, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json");
        if (status == 204) { ex.sendResponseHeaders(204, -1); ex.close(); return; }
        ex.sendResponseHeaders(status, bytes.length);
        try (var out = ex.getResponseBody()) { out.write(bytes); }
    }
}
