package com.hackathon.mathportal.modules.Estadistica;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIf(value = "databaseAvailable", disabledReason = "Requiere Docker o TEST_DB_URL de PostgreSQL desechable")
class EstadisticasPostgresIntegrationTest {
    private static final String VERSION = "30000000-0000-0000-0000-000000000001";
    private static PostgreSQLContainer<?> postgres;
    private final UUID subject = UUID.randomUUID();
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    static boolean databaseAvailable() {
        return System.getenv("TEST_DB_URL") != null || DockerClientFactory.instance().isDockerAvailable();
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        String url = System.getenv("TEST_DB_URL");
        if (url != null) {
            registry.add("spring.datasource.url", () -> url);
            registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DB_USERNAME", "postgres"));
            registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DB_PASSWORD", "postgres"));
        } else {
            postgres = new PostgreSQLContainer<>("postgres:17-alpine").withInitScript("test-postgres-init.sql");
            postgres.start();
            registry.add("spring.datasource.url", postgres::getJdbcUrl);
            registry.add("spring.datasource.username", postgres::getUsername);
            registry.add("spring.datasource.password", postgres::getPassword);
        }
    }

    @BeforeEach
    void setup() throws Exception {
        // Solo bases desechables de prueba, nunca la conexion real ni archivos .env.
        jdbc.execute("TRUNCATE math_portal.alumnos CASCADE");
        jdbc.execute("TRUNCATE math_portal.schools CASCADE");
        call(post("/students/me").contentType("application/json").content("{\"alias\":\"Ana\"}"), subject)
            .andExpect(status().isCreated());
    }

    @AfterAll
    static void stop() { if (postgres != null) postgres.stop(); }

    @Test
    void snapshotsIncludeOmissionsAndFailuresAndRetriesDoNotDuplicateHistory() throws Exception {
        UUID failed = UUID.randomUUID(), passed = UUID.randomUUID();
        submit(failed, Map.of("q1", "a")).andExpect(status().isOk());
        submit(passed, Map.of("q1", "b", "q2", "a")).andExpect(status().isOk());
        submit(passed, Map.of("q1", "b", "q2", "a")).andExpect(status().isOk());
        call(get("/estadisticas/me"), subject).andExpect(status().isOk())
            .andExpect(jsonPath("$.totales.partidas_terminadas").value(2))
            .andExpect(jsonPath("$.totales.desafios_completados").value(1))
            .andExpect(jsonPath("$.totales.porcentaje_aciertos").value(50))
            .andExpect(jsonPath("$.totales.partidas_con_tiempo").value(0))
            .andExpect(jsonPath("$.totales.tiempo_activo_ms").isEmpty())
            .andExpect(jsonPath("$.progresoNivel.xp_total").value(50))
            .andExpect(jsonPath("$.rachaPractica.current").value(1))
            .andExpect(jsonPath("$.aciertosPorTema[0].preguntas").value(4));
        call(get("/estadisticas/me/historial/errores"), subject).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.content[1].omitida").value(true));
        call(get("/estadisticas/me/historial/niveles"), subject).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].reconstruido").value(false));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM math_portal.estadistica_respuestas", Long.class)).isEqualTo(4);
    }

    @Test
    void timesAreIndividualAndAveragesExcludeUnknownTimes() throws Exception {
        UUID first = UUID.randomUUID(), second = UUID.randomUUID();
        submit(first, Map.of("q1", "b")).andExpect(status().isOk());
        submit(second, Map.of("q1", "b")).andExpect(status().isOk());
        Instant end = Instant.now().minusSeconds(5).truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
        String body = json.writeValueAsString(Map.of("iniciadaEn", end.minusSeconds(60).toString(),
            "finalizadaEn", end.toString(), "tiempoActivoMs", 20_000));
        for (int i = 0; i < 2; i++) {
            call(put("/estadisticas/me/partidas/" + first + "/tiempo").contentType("application/json").content(body), subject)
                .andExpect(status().isOk()).andExpect(jsonPath("$.tiempoTranscurridoMs").value(60_000))
                .andExpect(jsonPath("$.tiempoActivoMs").value(20_000));
        }
        call(get("/estadisticas/me"), subject).andExpect(status().isOk())
            .andExpect(jsonPath("$.tiemposPorDesafio[0].partidas_terminadas").value(2))
            .andExpect(jsonPath("$.tiemposPorDesafio[0].partidas_con_tiempo").value(1))
            .andExpect(jsonPath("$.tiemposPorDesafio[0].promedio_transcurrido_ms").value(60_000))
            .andExpect(jsonPath("$.tiemposPorDesafio[0].promedio_activo_ms").value(20_000));
        call(put("/estadisticas/me/partidas/" + first + "/tiempo").contentType("application/json")
            .content(body.replace("20000", "10000")), subject).andExpect(status().isConflict());
        UUID other = UUID.randomUUID();
        call(post("/students/me").contentType("application/json").content("{\"alias\":\"Otro\"}"), other)
            .andExpect(status().isCreated());
        call(put("/estadisticas/me/partidas/" + first + "/tiempo").contentType("application/json").content(body), other)
            .andExpect(status().isNotFound());
    }

    @Test
    void allTeacherRoutesEnforceClassroomAssignmentAndApiPrefixOccursOnce() throws Exception {
        UUID teacher = UUID.randomUUID(), outsider = UUID.randomUUID();
        UUID school = UUID.randomUUID(), course = UUID.randomUUID(), classroom = UUID.randomUUID();
        UUID alumno = jdbc.queryForObject("SELECT id FROM math_portal.alumnos WHERE auth_subject = ?",
            UUID.class, subject.toString());
        jdbc.update("INSERT INTO math_portal.schools VALUES (?, 'Colegio')", school);
        jdbc.update("INSERT INTO math_portal.courses VALUES (?, ?, 'Curso')", course, school);
        jdbc.update("INSERT INTO math_portal.school_memberships VALUES (?, ?, 'PROFESOR'), (?, ?, 'PROFESOR'), (?, ?, 'ALUMNO')",
            school, teacher, school, outsider, school, subject);
        jdbc.update("INSERT INTO math_portal.course_memberships VALUES (?, ?, ?, 'PROFESOR'), (?, ?, ?, 'ALUMNO')",
            school, course, teacher, school, course, subject);
        jdbc.update("""
            INSERT INTO math_portal.classrooms (id, school_id, grade, section, academic_year, teacher_id)
            VALUES (?, ?, 'PRIMERO', 'A', 2026, ?)
            """, classroom, school, teacher);
        jdbc.update("""
            INSERT INTO math_portal.classroom_students (school_id, classroom_id, academic_year, student_id)
            VALUES (?, ?, 2026, ?)
            """, school, classroom, subject);
        for (String suffix : List.of("", "/desafios", "/historial/niveles", "/historial/errores")) {
            String path = "/estadisticas/profesor/alumnos/" + alumno + suffix;
            call(get(path), teacher).andExpect(status().isOk());
            call(get(path), outsider).andExpect(status().isNotFound());
        }
        call(get("/estadisticas/profesor/alumnos"), subject).andExpect(status().isForbidden());
        mvc.perform(get("/api/estadisticas/me").contextPath("/api")).andExpect(status().isUnauthorized());
        call(get("/api/estadisticas/me"), subject).andExpect(status().isNotFound());
        jdbc.update("DELETE FROM math_portal.classroom_students WHERE school_id = ? AND classroom_id = ? AND student_id = ?",
            school, classroom, subject);
        call(get("/estadisticas/profesor/alumnos/" + alumno), teacher).andExpect(status().isNotFound());
    }

    @Test
    void levelHistoryKeepsHistoricalNameAndFailedPracticeCountsForStreak() throws Exception {
        UUID failed = UUID.randomUUID();
        submit(failed, Map.of("q1", "a")).andExpect(status().isOk());
        call(get("/estadisticas/me"), subject).andExpect(jsonPath("$.rachaPractica.current").value(1))
            .andExpect(jsonPath("$.totales.desafios_completados").value(0));
        submit(UUID.randomUUID(), Map.of("q1", "b", "q2", "a")).andExpect(status().isOk());
        String name = jdbc.queryForObject("SELECT nivel_nombre FROM math_portal.estadistica_niveles", String.class);
        jdbc.update("UPDATE math_portal.niveles_alumno SET nombre = 'Renombrado' WHERE numero = 1");
        try {
            call(get("/estadisticas/me/historial/niveles"), subject)
                .andExpect(jsonPath("$.content[0].nivel_nombre").value(name));
        } finally {
            jdbc.update("UPDATE math_portal.niveles_alumno SET nombre = ? WHERE numero = 1", name);
        }
    }

    @Test
    void databaseConstraintsAndTransactionRollbackProtectHistory() throws Exception {
        UUID id = UUID.randomUUID();
        submit(id, Map.of("q1", "b")).andExpect(status().isOk());
        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO math_portal.estadistica_tiempos (partida_id, iniciada_en, finalizada_en, tiempo_activo_ms)
            VALUES (?, CURRENT_TIMESTAMP - interval '1 second', CURRENT_TIMESTAMP, 2000)
            """, id)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        Long before = jdbc.queryForObject("SELECT count(*) FROM math_portal.estadistica_respuestas", Long.class);
        var transaction = new org.springframework.transaction.support.TransactionTemplate(
            new org.springframework.jdbc.datasource.DataSourceTransactionManager(jdbc.getDataSource()));
        transaction.executeWithoutResult(status -> {
            jdbc.update("""
                INSERT INTO math_portal.partidas
                    (id, alumno_id, actividad_version_id, respuestas, puntaje_porcentaje, aprobada, origen,
                     recibida_en, fecha_aprendizaje, zona_horaria_aplicada)
                SELECT ?, alumno_id, actividad_version_id, respuestas, puntaje_porcentaje, aprobada, origen,
                    recibida_en, fecha_aprendizaje, zona_horaria_aplicada FROM math_portal.partidas WHERE id = ?
                """, UUID.randomUUID(), id);
            status.setRollbackOnly();
        });
        assertThat(jdbc.queryForObject("SELECT count(*) FROM math_portal.estadistica_respuestas", Long.class)).isEqualTo(before);
    }

    @Test
    void backfillReconstructsExistingAnswersAndMarksHistoricalLevels() throws Exception {
        submit(UUID.randomUUID(), Map.of("q1", "a")).andExpect(status().isOk());
        submit(UUID.randomUUID(), Map.of("q1", "b", "q2", "a")).andExpect(status().isOk());
        // Simular datos anteriores a V7 conservando partidas y movimientos originales.
        jdbc.update("DELETE FROM math_portal.estadistica_respuestas");
        jdbc.update("DELETE FROM math_portal.estadistica_niveles");
        String migration = new org.springframework.core.io.ClassPathResource("db/migration/V7__estadisticas.sql")
            .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        for (String marker : List.of("INSERT INTO math_portal.estadistica_respuestas", "WITH acumulados AS (")) {
            int start = migration.indexOf(marker);
            jdbc.execute(migration.substring(start, migration.indexOf(';', start) + 1));
        }
        call(get("/estadisticas/me/historial/niveles"), subject).andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].reconstruido").value(true))
            .andExpect(jsonPath("$.content[0].xp_total").value(50));
        call(get("/estadisticas/me"), subject).andExpect(status().isOk())
            .andExpect(jsonPath("$.totales.porcentaje_aciertos").value(50))
            .andExpect(jsonPath("$.totales.partidas_con_tiempo").value(0));
        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM math_portal.estadistica_respuestas WHERE respuesta_elegida IS NULL",
            Long.class)).isEqualTo(1);
    }

    private ResultActions submit(UUID id, Map<String, String> answers) throws Exception {
        return call(post("/attempts").contentType("application/json").content(json.writeValueAsString(
            Map.of("id", id, "activityVersionId", VERSION, "answers", answers, "origin", "ONLINE"))), subject);
    }

    private ResultActions call(MockHttpServletRequestBuilder request, UUID user) throws Exception {
        request.with(servletRequest -> {
            servletRequest.setRequestURI("/api" + servletRequest.getRequestURI());
            servletRequest.setContextPath("/api");
            return servletRequest;
        });
        return mvc.perform(request.with(jwt().jwt(j -> j.subject(user.toString()))));
    }
}
