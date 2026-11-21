package com.hackathon.mathportal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.*;
import com.hackathon.mathportal.modules.progress.service.AttemptService;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(StudentApiIntegrationTest.TimeConfig.class)
@EnabledIf(value = "databaseAvailable", disabledReason = "Requiere Docker o TEST_DB_URL de una base PostgreSQL desechable")
class StudentApiIntegrationTest {
    static final UUID VERSION = UUID.fromString("30000000-0000-0000-0000-000000000002");
    static final String ACTIVITY = "20000000-0000-0000-0000-000000000001";
    static final String ISSUER = "https://test.mathportal.invalid/auth/v1";
    static PostgreSQLContainer<?> postgres;
    static HttpServer jwks;
    static RSAKey signingKey;

    static boolean databaseAvailable() {
        return System.getenv("TEST_DB_URL") != null || DockerClientFactory.instance().isDockerAvailable();
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry properties) throws Exception {
        String externalUrl = System.getenv("TEST_DB_URL");
        if (externalUrl != null) {
            properties.add("spring.datasource.url", () -> externalUrl);
            properties.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DB_USERNAME", "postgres"));
            properties.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DB_PASSWORD", "postgres"));
        } else {
            postgres = new PostgreSQLContainer<>("postgres:17-alpine");
            postgres.start();
            properties.add("spring.datasource.url", postgres::getJdbcUrl);
            properties.add("spring.datasource.username", postgres::getUsername);
            properties.add("spring.datasource.password", postgres::getPassword);
        }
        signingKey = new RSAKeyGenerator(2048).keyID("integration-test").generate();
        jwks = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        jwks.createContext("/jwks", exchange -> {
            byte[] body = new JWKSet(signingKey.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (var stream = exchange.getResponseBody()) { stream.write(body); }
        });
        jwks.start();
        properties.add("spring.security.oauth2.resourceserver.jwt.issuer-uri", () -> ISSUER);
        properties.add("spring.security.oauth2.resourceserver.jwt.jwk-set-uri",
            () -> "http://127.0.0.1:" + jwks.getAddress().getPort() + "/jwks");
    }

    @AfterAll
    static void stopInfrastructure() {
        if (jwks != null) jwks.stop(0);
        if (postgres != null) postgres.stop();
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired MutableClock clock;
    @Autowired AttemptService attempts;

    @BeforeEach
    void reset() {
        // This suite MUST target a disposable database. It never reads the application's .env.
        jdbc.execute("TRUNCATE math_portal.alumnos CASCADE");
        jdbc.update("UPDATE math_portal.actividades SET activa = false WHERE id <> ?::uuid", ACTIVITY);
        // Deterministic publication date: the production seed was published at migration time,
        // which may be later than this test's clock. Never edit an immutable published version.
        jdbc.update("""
            INSERT INTO math_portal.actividad_versiones
                (id, actividad_id, numero_version, dificultad, contenido, reglas_evaluacion, xp_recompensa, publicada_en)
            SELECT ?, actividad_id, 2, dificultad, contenido, reglas_evaluacion, xp_recompensa,
                '2026-01-01T00:00:00Z'::timestamptz
            FROM math_portal.actividad_versiones WHERE id = '30000000-0000-0000-0000-000000000001'
            ON CONFLICT DO NOTHING
            """, VERSION);
        clock.set(Instant.parse("2026-11-21T18:00:00Z"));
    }

    @Test
    void createsProfileAndStartsAtZeroWithoutLeakingIdentity() throws Exception {
        var profile = createStudent("emily", false);
        assertThat(profile.path("timeZone").asText()).isEqualTo("America/Guatemala");
        assertThat(profile.has("authSubject")).isFalse();
        call(get("/students/me/progress"), "emily")
            .andExpect(jsonPath("$.totalXp").value(0))
            .andExpect(jsonPath("$.level.number").value(1))
            .andExpect(jsonPath("$.streak.current").value(0));
        call(post("/students/me").contentType(MediaType.APPLICATION_JSON).content("{\"alias\":\"Otro\"}"), "emily")
            .andExpect(status().isConflict());
    }

    @Test
    void validatesProfileAndKeepsAccountsSeparate() throws Exception {
        createStudent("emily", false);
        createStudent("ana", false);
        call(get("/students/me"), "emily").andExpect(jsonPath("$.alias").value("emily"));
        call(get("/students/me"), "ana").andExpect(jsonPath("$.alias").value("ana"));
        call(patch("/students/me").contentType(MediaType.APPLICATION_JSON)
            .content("{\"timeZone\":\"zona-inventada\"}"), "emily").andExpect(status().isBadRequest());
        call(patch("/students/me").contentType(MediaType.APPLICATION_JSON)
            .content("{\"alias\":\"   \"}"), "emily").andExpect(status().isBadRequest());
        call(patch("/students/me").contentType(MediaType.APPLICATION_JSON)
            .content("{\"totalXp\":9999}"), "emily").andExpect(status().isBadRequest());
        call(patch("/students/me").contentType(MediaType.APPLICATION_JSON)
            .content("{\"rankingEnabled\":true,\"schoolGrade\":\"\"}"), "emily")
            .andExpect(status().isOk()).andExpect(jsonPath("$.rankingEnabled").value(true));
    }

    @Test
    void awardsOnlyOnceAndRejectsReusedUuidWithChangedContentOrOwner() throws Exception {
        createStudent("emily", true);
        UUID id = UUID.randomUUID();
        var request = submission(id, Map.of("q1", "b", "q2", "a"));
        for (int i = 0; i < 2; i++) {
            submit("emily", request).andExpect(status().isOk())
                .andExpect(jsonPath("$.attempt.awardedXp").value(50))
                .andExpect(jsonPath("$.progress.totalXp").value(50));
        }
        submit("emily", submission(UUID.randomUUID(), request.answers())).andExpect(status().isOk())
            .andExpect(jsonPath("$.attempt.awardedXp").value(0));
        submit("emily", submission(id, Map.of("q1", "a"))).andExpect(status().isConflict());
        createStudent("ana", true);
        submit("ana", request).andExpect(status().isConflict());
        call(get("/students/me/attempts"), "emily").andExpect(jsonPath("$.totalElements").value(2));
        call(get("/students/me/attempts"), "ana").andExpect(jsonPath("$.totalElements").value(0));
        call(get("/students/me/activities/" + ACTIVITY + "/progress"), "emily")
            .andExpect(jsonPath("$.attempts").value(2)).andExpect(jsonPath("$.status").value("COMPLETADA"));
        assertThat(count("movimientos_puntos")).isEqualTo(1);
        assertThat(count("dias_aprendizaje")).isEqualTo(1);
    }

    @Test
    void failedAndInvalidAnswersDoNotAwardPointsOrStreak() throws Exception {
        createStudent("emily", false);
        submit("emily", submission(UUID.randomUUID(), Map.of("q1", "a", "q2", "b")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.attempt.passed").value(false))
            .andExpect(jsonPath("$.progress.totalXp").value(0)).andExpect(jsonPath("$.progress.streak.current").value(0));
        submit("emily", submission(UUID.randomUUID(), Map.of("desconocida", "a")))
            .andExpect(status().isBadRequest());
        submit("emily", submission(UUID.randomUUID(), Map.of())).andExpect(status().isBadRequest());
        assertThat(count("partidas")).isEqualTo(1);
        assertThat(count("movimientos_puntos")).isZero();
        assertThat(count("dias_aprendizaje")).isZero();
    }

    @Test
    void offlineUsesReceptionDateAndTracksConsecutiveDaysWithoutRewritingHistory() throws Exception {
        createStudent("emily", false);
        var request = submission(UUID.randomUUID(), Map.of("q1", "b", "q2", "a"));
        submit("emily", request).andExpect(jsonPath("$.attempt.learningDate").value("2026-11-21"));
        clock.set(Instant.parse("2026-11-22T18:00:00Z"));
        submit("emily", submission(UUID.randomUUID(), request.answers()))
            .andExpect(jsonPath("$.progress.streak.current").value(2));
        call(patch("/students/me").contentType(MediaType.APPLICATION_JSON)
            .content("{\"timeZone\":\"Asia/Tokyo\"}"), "emily").andExpect(status().isOk());
        clock.set(Instant.parse("2026-11-25T18:00:00Z"));
        call(get("/students/me/progress"), "emily").andExpect(jsonPath("$.streak.current").value(0))
            .andExpect(jsonPath("$.streak.longest").value(2));
        submit("emily", request).andExpect(jsonPath("$.attempt.learningDate").value("2026-11-21"))
            .andExpect(jsonPath("$.attempt.appliedTimeZone").value("America/Guatemala"));
    }

    @Test
    void rankingSharesTiesAcrossPagesAndHonorsOptOutAndInactiveProfiles() throws Exception {
        for (String subject : List.of("emily", "ana", "privada", "inactiva")) {
            createStudent(subject, !subject.equals("privada"));
            submit(subject, submission(UUID.randomUUID(), Map.of("q1", "b", "q2", "a")))
                .andExpect(status().isOk());
        }
        jdbc.update("UPDATE math_portal.alumnos SET estado = 'INACTIVO' WHERE auth_subject = 'inactiva'");
        for (int page = 0; page < 2; page++) {
            var result = call(get("/ranking").param("page", "" + page).param("size", "1"), "emily")
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].position").value(1))
                .andExpect(jsonPath("$.content[0].totalXp").value(50))
                .andReturn().getResponse().getContentAsString();
            assertThat(result).doesNotContain("authSubject", "studentId", "privada", "inactiva");
        }
        call(get("/students/me"), "inactiva").andExpect(status().isForbidden());
        call(get("/ranking").param("size", "101"), "emily").andExpect(status().isBadRequest());
    }

    @Test
    void concurrentSubmissionsAndRetriesPreserveSingleReward() throws Exception {
        createStudent("emily", false);
        var request = submission(UUID.randomUUID(), Map.of("q1", "b", "q2", "a"));
        var another = submission(UUID.randomUUID(), request.answers());
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<AttemptResult>> results = new ArrayList<>();
            for (var item : List.of(request, request, another, another)) {
                results.add(executor.submit(() -> {
                    gate.await();
                    var jwt = Jwt.withTokenValue("test").header("alg", "none").subject("emily").build();
                    SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
                    try { return attempts.submit(item); }
                    finally { SecurityContextHolder.clearContext(); }
                }));
            }
            gate.countDown();
            for (var result : results) assertThat(result.get(20, TimeUnit.SECONDS).progress().totalXp()).isEqualTo(50);
        }
        assertThat(count("partidas")).isEqualTo(2);
        assertThat(count("movimientos_puntos")).isEqualTo(1);
        assertThat(count("dias_aprendizaje")).isEqualTo(1);
        call(get("/students/me/activities/" + ACTIVITY + "/progress"), "emily")
            .andExpect(jsonPath("$.attempts").value(2));
    }

    @Test
    void firstApprovalOfZeroRewardCannotEarnXpFromAnotherVersion() throws Exception {
        createStudent("emily", false);
        UUID activityId = UUID.randomUUID();
        UUID freeVersion = addActivityVersion(activityId, 1, 0);
        var first = new SubmitAttempt(UUID.randomUUID(), freeVersion, Map.of("q1", "b"), Origin.ONLINE, null);
        submit("emily", first).andExpect(status().isOk()).andExpect(jsonPath("$.attempt.awardedXp").value(0))
            .andExpect(jsonPath("$.attempt.passed").value(true));
        UUID paidVersion = addActivityVersion(activityId, 2, 100);
        submit("emily", new SubmitAttempt(UUID.randomUUID(), paidVersion, first.answers(), Origin.ONLINE, null))
            .andExpect(status().isOk()).andExpect(jsonPath("$.attempt.awardedXp").value(0))
            .andExpect(jsonPath("$.progress.totalXp").value(0));
        assertThat(count("movimientos_puntos")).isZero();
        assertThat(count("dias_aprendizaje")).isEqualTo(1);
    }

    @Test
    void levelsAreDerivedFromAccumulatedXpAndTopicProgressReflectsCompletion() throws Exception {
        createStudent("emily", true);
        UUID version = addActivityVersion(UUID.randomUUID(), 1, 100);
        submit("emily", new SubmitAttempt(UUID.randomUUID(), version, Map.of("q1", "b"), Origin.ONLINE, null))
            .andExpect(status().isOk()).andExpect(jsonPath("$.progress.totalXp").value(100))
            .andExpect(jsonPath("$.progress.level.number").value(2))
            .andExpect(jsonPath("$.progress.nextLevel.number").value(3))
            .andExpect(jsonPath("$.progress.xpToNextLevel").value(150))
            .andExpect(jsonPath("$.progress.topics[0].completed").value(1))
            .andExpect(jsonPath("$.progress.topics[0].total").value(2));
        call(get("/ranking"), "emily").andExpect(jsonPath("$.content[0].level.number").value(2));
    }

    @Test
    void derivedWriteFailureRollsBackEntireAttempt() throws Exception {
        createStudent("emily", false);
        jdbc.execute("""
            CREATE OR REPLACE FUNCTION math_portal.fail_learning_day() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'simulated test write failure'; END; $$
            """);
        jdbc.execute("""
            CREATE TRIGGER fail_learning_day BEFORE INSERT ON math_portal.dias_aprendizaje
            FOR EACH ROW EXECUTE FUNCTION math_portal.fail_learning_day()
            """);
        try {
            assertThatThrownBy(() -> submit("emily", submission(UUID.randomUUID(), Map.of("q1", "b"))))
                .hasStackTraceContaining("simulated test write failure");
        } finally {
            jdbc.execute("DROP TRIGGER fail_learning_day ON math_portal.dias_aprendizaje");
            jdbc.execute("DROP FUNCTION math_portal.fail_learning_day()");
        }
        assertThat(count("partidas")).isZero();
        assertThat(count("progreso_actividades")).isZero();
        assertThat(count("movimientos_puntos")).isZero();
        assertThat(count("dias_aprendizaje")).isZero();
    }

    @Test
    void authenticatesRealSignedTokensAndRejectsWrongAudienceIssuerSignatureAndExpiration() throws Exception {
        mvc.perform(get("/levels")).andExpect(status().isUnauthorized());
        mvc.perform(get("/levels").header("Authorization", "Bearer " + token(ISSUER, "authenticated", false, signingKey)))
            .andExpect(status().isOk());
        for (String invalid : List.of(token(ISSUER, "other", false, signingKey),
                token("https://wrong.invalid", "authenticated", false, signingKey),
                token(ISSUER, "authenticated", true, signingKey),
                token(ISSUER, "authenticated", false, new RSAKeyGenerator(2048).keyID("integration-test").generate()))) {
            mvc.perform(get("/levels").header("Authorization", "Bearer " + invalid)).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void requiresSubjectAndExpirationInSignedTokens() throws Exception {
        var withoutSubject = new JWTClaimsSet.Builder().issuer(ISSUER).audience("authenticated")
            .expirationTime(Date.from(Instant.now().plusSeconds(600))).build();
        var withoutExpiration = new JWTClaimsSet.Builder().issuer(ISSUER).audience("authenticated").subject("emily").build();
        for (var claims : List.of(withoutSubject, withoutExpiration)) {
            mvc.perform(get("/levels").header("Authorization", "Bearer " + signedToken(claims, signingKey)))
                .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void contentDoesNotExposeAnswerKeysAndPublishedVersionsCannotBeEdited() throws Exception {
        var response = call(get("/activities/" + ACTIVITY + "/versions/latest"), "emily")
            .andExpect(status().isOk()).andExpect(jsonPath("$.content.questions[0].id").value("q1"))
            .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("evaluationRules", "correctAnswers", "passingPercentage");
        assertThatThrownBy(() -> jdbc.update("UPDATE math_portal.actividad_versiones SET xp_recompensa = 999 WHERE id = ?", VERSION))
            .hasMessageContaining("inmutables");
    }

    private JsonNode createStudent(String subject, boolean ranking) throws Exception {
        var response = call(post("/students/me").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("alias", subject, "rankingEnabled", ranking))), subject)
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response);
    }

    private SubmitAttempt submission(UUID id, Map<String, String> answers) {
        return new SubmitAttempt(id, VERSION, answers, Origin.OFFLINE, Instant.parse("2026-11-15T12:00:00.123456789Z"));
    }

    private org.springframework.test.web.servlet.ResultActions submit(String subject, SubmitAttempt request) throws Exception {
        return call(post("/attempts").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)), subject);
    }

    private org.springframework.test.web.servlet.ResultActions call(MockHttpServletRequestBuilder request, String subject) throws Exception {
        return mvc.perform(request.with(jwt().jwt(jwt -> jwt.subject(subject))));
    }

    private long count(String table) { return jdbc.queryForObject("SELECT count(*) FROM math_portal." + table, Long.class); }

    private UUID addActivityVersion(UUID activityId, int number, int reward) {
        jdbc.update("""
            INSERT INTO math_portal.actividades (id, tema_id, titulo, tipo_juego, orden, activa)
            SELECT ?, tema_id, 'Actividad de prueba', tipo_juego, 2, true
            FROM math_portal.actividades WHERE id = ?::uuid ON CONFLICT DO NOTHING
            """, activityId, ACTIVITY);
        UUID versionId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO math_portal.actividad_versiones
                (id, actividad_id, numero_version, dificultad, contenido, reglas_evaluacion, xp_recompensa, publicada_en)
            SELECT ?, ?, ?, dificultad, contenido, reglas_evaluacion, ?, '2026-01-01T00:00:00Z'::timestamptz
            FROM math_portal.actividad_versiones WHERE id = ?
            """, versionId, activityId, number, reward, VERSION);
        return versionId;
    }

    private String token(String issuer, String audience, boolean expired, RSAKey key) throws Exception {
        var now = Instant.now();
        var claims = new JWTClaimsSet.Builder().subject("emily").issuer(issuer).audience(audience)
            .issueTime(Date.from(now.minusSeconds(900))).expirationTime(Date.from(now.plusSeconds(expired ? -600 : 600))).build();
        return signedToken(claims, key);
    }

    private String signedToken(JWTClaimsSet claims, RSAKey key) throws Exception {
        var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("integration-test").build(), claims);
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    @TestConfiguration
    static class TimeConfig {
        @Bean @Primary MutableClock mutableClock() { return new MutableClock(); }
    }

    static class MutableClock extends Clock {
        private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-11-21T18:00:00Z"));
        void set(Instant instant) { now.set(instant); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return Clock.fixed(now.get(), zone); }
        @Override public Instant instant() { return now.get(); }
    }
}
