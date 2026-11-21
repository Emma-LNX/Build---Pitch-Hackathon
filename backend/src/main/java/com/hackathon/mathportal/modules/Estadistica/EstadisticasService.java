package com.hackathon.mathportal.modules.Estadistica;

import com.hackathon.mathportal.common.PageResponse;
import com.hackathon.mathportal.modules.Estadistica.EstadisticasDtos.*;
import com.hackathon.mathportal.modules.Estadistica.EstadisticasRepository.Historial;
import com.hackathon.mathportal.modules.auth.service.CurrentIdentity;
import com.hackathon.mathportal.modules.progress.service.StreakCalculator;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class EstadisticasService {
    private final EstadisticasRepository repository;
    private final CurrentIdentity identity;
    private final Clock clock;

    public EstadisticasService(EstadisticasRepository repository, CurrentIdentity identity, Clock clock) {
        this.repository = repository;
        this.identity = identity;
        this.clock = clock;
    }

    public Resumen propias() { return resumen(actual()); }

    public Resumen alumno(UUID alumno) { return resumen(asignado(alumno)); }

    public PageResponse<Map<String, Object>> alumnos(int page, int size) {
        return repository.alumnos(profesor(), page, size);
    }

    public PageResponse<Map<String, Object>> historialPropio(Historial tipo, int page, int size) {
        return repository.historial(actual().id(), tipo, page, size);
    }

    public PageResponse<Map<String, Object>> historialAlumno(UUID alumno, Historial tipo, int page, int size) {
        return repository.historial(asignado(alumno).id(), tipo, page, size);
    }

    @Transactional
    public Tiempo registrarTiempo(UUID partida, RegistrarTiempo request) {
        UUID alumno = actual().id();
        var recibida = repository.partidaRecibida(alumno, partida).orElseThrow(this::noEncontrado);
        // Precision de milisegundos comun con el cliente. Las estadisticas nunca inventan tiempos.
        var normalizado = new RegistrarTiempo(request.iniciadaEn().truncatedTo(ChronoUnit.MILLIS),
            request.finalizadaEn().truncatedTo(ChronoUnit.MILLIS), request.tiempoActivoMs());
        long transcurrido;
        try {
            transcurrido = Duration.between(normalizado.iniciadaEn(), normalizado.finalizadaEn()).toMillis();
        } catch (ArithmeticException ex) {
            throw invalido();
        }
        if (transcurrido < 0 || normalizado.tiempoActivoMs() < 0
                || normalizado.tiempoActivoMs() > transcurrido
                || normalizado.finalizadaEn().isAfter(recibida)
                || normalizado.finalizadaEn().isAfter(clock.instant())) throw invalido();

        // INSERT ON CONFLICT hace los reintentos atomicos, incluso con peticiones concurrentes.
        repository.guardarTiempo(alumno, partida, normalizado);
        var guardado = repository.tiempo(alumno, partida);
        if (!guardado.iniciadaEn().equals(normalizado.iniciadaEn())
                || !guardado.finalizadaEn().equals(normalizado.finalizadaEn())
                || guardado.tiempoActivoMs() != normalizado.tiempoActivoMs()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La partida ya tiene otro tiempo registrado");
        }
        return guardado;
    }

    private Alumno actual() {
        return repository.propia(identity.subject()).orElseThrow(this::noEncontrado);
    }

    private UUID profesor() {
        UUID subject = UUID.fromString(identity.subject());
        if (!repository.esProfesor(subject)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Se requiere membresia de profesor");
        }
        return subject;
    }

    private Alumno asignado(UUID alumno) {
        return repository.asignada(profesor(), alumno).orElseThrow(this::noEncontrado);
    }

    private Resumen resumen(Alumno alumno) {
        var hoy = LocalDate.ofInstant(clock.instant(), ZoneId.of(alumno.zonaHoraria()));
        return new Resumen(alumno, repository.nivel(alumno.id()),
            StreakCalculator.calculate(repository.dias(alumno.id()), hoy),
            repository.totales(alumno.id()), repository.temas(alumno.id()), repository.tiempos(alumno.id()));
    }

    private ResponseStatusException noEncontrado() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Alumno o partida no disponible");
    }

    private ResponseStatusException invalido() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Usa fechas ordenadas anteriores a la recepcion de la partida y 0 <= tiempoActivoMs <= duracion");
    }

    public double calcularPorcentajeAciertos(int correctas, int total) {
        if (total <= 0 || correctas < 0 || correctas > total) throw new IllegalArgumentException("Conteos invalidos");
        return correctas * 100.0 / total;
    }

    public double calcularPorcentajeError(int correctas, int total) {
        return 100.0 - calcularPorcentajeAciertos(correctas, total);
    }

    public double calcularTiempoPromedio(List<Integer> segundos) {
        if (segundos == null || segundos.isEmpty() || segundos.stream().anyMatch(t -> t == null || t < 0)) {
            throw new IllegalArgumentException("Se necesitan tiempos no negativos");
        }
        return segundos.stream().mapToLong(Integer::longValue).average().orElseThrow();
    }
}