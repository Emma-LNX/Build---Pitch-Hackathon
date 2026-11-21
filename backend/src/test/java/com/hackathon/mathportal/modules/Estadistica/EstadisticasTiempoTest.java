package com.hackathon.mathportal.modules.Estadistica;

import static org.assertj.core.api.Assertions.*;
import com.hackathon.mathportal.modules.Estadistica.EstadisticasDtos.*;
import com.hackathon.mathportal.modules.auth.service.CurrentIdentity;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

class EstadisticasTiempoTest {
    private static final Instant NOW = Instant.parse("2026-11-21T18:00:00Z");
    private final UUID student = UUID.randomUUID(), attempt = UUID.randomUUID();
    private final MemoryRepository repository = new MemoryRepository();
    private final EstadisticasService service = new EstadisticasService(repository, new CurrentIdentity(),
        Clock.fixed(NOW, ZoneOffset.UTC));

    @BeforeEach
    void authenticate() {
        var jwt = Jwt.withTokenValue("test").header("alg", "RS256").subject(student.toString()).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    @AfterEach
    void cleanup() { SecurityContextHolder.clearContext(); }

    @Test
    void activeTimeAndElapsedTimeDifferAndRetriesAreIdempotent() {
        var request = new RegistrarTiempo(NOW.minusSeconds(120), NOW.minusSeconds(60), 20_000L);
        var result = service.registrarTiempo(attempt, request);
        assertThat(result.tiempoTranscurridoMs()).isEqualTo(60_000);
        assertThat(result.tiempoActivoMs()).isEqualTo(20_000);
        assertThat(service.registrarTiempo(attempt, request)).isEqualTo(result);
        assertThatThrownBy(() -> service.registrarTiempo(attempt,
            new RegistrarTiempo(request.iniciadaEn(), request.finalizadaEn(), 10_000L)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(409));
    }

    @Test
    void invalidIntervalsAndTimesBeyondReceiptAreRejectedBeforeSaving() {
        var invalid = List.of(
            new RegistrarTiempo(NOW.minusSeconds(60), NOW, 60_001L),
            new RegistrarTiempo(NOW, NOW.minusSeconds(1), 0L),
            new RegistrarTiempo(NOW.minusSeconds(1), NOW, -1L),
            new RegistrarTiempo(NOW, NOW.plusSeconds(1), 0L));
        for (var request : invalid) {
            assertThatThrownBy(() -> service.registrarTiempo(attempt, request))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                    ex -> assertThat(ex.getStatusCode().value()).isEqualTo(400));
        }
        assertThat(repository.saved).isNull();
    }

    @Test
    void foreignAttemptIsHiddenBeforeWriting() {
        assertThatThrownBy(() -> service.registrarTiempo(UUID.randomUUID(),
            new RegistrarTiempo(NOW.minusSeconds(1), NOW, 0L)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(404));
        assertThat(repository.saved).isNull();
    }

    @Test
    void timestampsAreNormalizedToMillisecondsForStableRetries() {
        var result = service.registrarTiempo(attempt, new RegistrarTiempo(
            NOW.minusSeconds(1).plusNanos(123456), NOW, 999L));
        assertThat(result.tiempoTranscurridoMs()).isEqualTo(1000);
    }

    private class MemoryRepository extends EstadisticasRepository {
        Tiempo saved;
        MemoryRepository() { super(null); }
        @Override public Optional<Alumno> propia(String subject) {
            return Optional.of(new Alumno(student, "Ana", "America/Guatemala"));
        }
        @Override public Optional<Instant> partidaRecibida(UUID owner, UUID id) {
            return owner.equals(student) && id.equals(attempt) ? Optional.of(NOW) : Optional.empty();
        }
        @Override public void guardarTiempo(UUID owner, UUID id, RegistrarTiempo time) {
            if (saved == null) saved = new Tiempo(id, time.iniciadaEn(), time.finalizadaEn(),
                Duration.between(time.iniciadaEn(), time.finalizadaEn()).toMillis(), time.tiempoActivoMs(), "CLIENTE");
        }
        @Override public Tiempo tiempo(UUID owner, UUID id) { return saved; }
    }
}