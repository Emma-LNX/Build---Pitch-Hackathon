package com.hackathon.mathportal.modules.Estadistica;

import com.hackathon.mathportal.modules.Estadistica.AprendizajeDtos.*;
import com.hackathon.mathportal.modules.Estadistica.AprendizajeRepository.Fila;
import com.hackathon.mathportal.modules.auth.service.CurrentIdentity;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Nivel por categoría del CNB con el mismo modelo tipo Elo que la app
 * (frontend/src/features/adaptive/engine.ts), para que ambos den el mismo resultado.
 */
@Service
@Transactional(readOnly = true)
public class AprendizajeService {
    static final List<String> CATEGORIAS =
        List.of("numeros", "maya", "suma-resta", "mult-div", "fracciones", "geometria", "medidas");
    private static final double K_DIAGNOSTICO = 0.8;
    private static final double K_PRACTICA = 0.3;
    private static final int ERRORES_RECIENTES = 60;

    private final AprendizajeRepository repository;
    private final EstadisticasRepository estadisticas;
    private final CurrentIdentity identity;

    public AprendizajeService(AprendizajeRepository repository, EstadisticasRepository estadisticas,
            CurrentIdentity identity) {
        this.repository = repository;
        this.estadisticas = estadisticas;
        this.identity = identity;
    }

    @Transactional
    public Guardadas guardar(Lote lote) {
        UUID alumno = actual();
        return new Guardadas(lote.respuestas().size(), repository.guardar(alumno, lote.respuestas()));
    }

    public Dominio propio() { return dominio(actual()); }

    public Dominio alumno(UUID alumno) {
        UUID profesor = UUID.fromString(identity.subject());
        if (!estadisticas.esProfesor(profesor)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Se requiere membresia de profesor");
        }
        return dominio(estadisticas.asignada(profesor, alumno).orElseThrow(this::noEncontrado).id());
    }

    private UUID actual() {
        return estadisticas.propia(identity.subject()).orElseThrow(this::noEncontrado).id();
    }

    private static final class Acumulado {
        double theta;
        int respuestas;
        int correctas;
        long tiempoMs;
    }

    private Dominio dominio(UUID alumno) {
        List<Fila> filas = repository.respuestas(alumno);
        Map<String, Acumulado> porCategoria = new LinkedHashMap<>();
        for (Fila f : filas) {
            Acumulado a = porCategoria.computeIfAbsent(f.categoria(), c -> new Acumulado());
            double p = probabilidad(a.theta, f.dificultad() - 2);
            double k = "DIAGNOSTICO".equals(f.origen()) ? K_DIAGNOSTICO : K_PRACTICA;
            a.theta += k * ((f.correcta() ? 1 : 0) - p);
            a.respuestas++;
            if (f.correcta()) a.correctas++;
            a.tiempoMs += f.tiempoMs();
        }

        List<Categoria> categorias = new ArrayList<>();
        for (String id : CATEGORIAS) {
            Acumulado a = porCategoria.get(id);
            if (a == null) continue;
            int puntaje = (int) Math.round(100 * probabilidad(a.theta, 0));
            categorias.add(new Categoria(id, puntaje, nivel(puntaje), a.respuestas, a.correctas,
                a.tiempoMs / a.respuestas));
        }

        Map<String, Integer> conteo = new HashMap<>();
        for (Fila f : filas.subList(Math.max(0, filas.size() - ERRORES_RECIENTES), filas.size())) {
            if (!f.correcta() && f.errorTag() != null && !"otro".equals(f.errorTag())) {
                conteo.merge(f.errorTag(), 1, Integer::sum);
            }
        }
        List<ErrorFrecuente> errores = conteo.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .limit(5)
            .map(e -> new ErrorFrecuente(e.getKey(), e.getValue()))
            .toList();

        List<String> recomendadas = categorias.stream()
            .sorted(Comparator.comparingInt(Categoria::puntaje))
            .limit(2)
            .map(Categoria::categoria)
            .toList();
        return new Dominio(alumno, categorias, errores, recomendadas);
    }

    private static double probabilidad(double theta, double dificultad) {
        return 1 / (1 + Math.exp(-(theta - dificultad)));
    }

    private static String nivel(int puntaje) {
        if (puntaje >= 90) return "Mazorca";
        if (puntaje >= 75) return "Elote";
        if (puntaje >= 60) return "Milpa";
        if (puntaje >= 40) return "Brote";
        return "Semilla";
    }

    private ResponseStatusException noEncontrado() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Alumno no disponible");
    }
}
