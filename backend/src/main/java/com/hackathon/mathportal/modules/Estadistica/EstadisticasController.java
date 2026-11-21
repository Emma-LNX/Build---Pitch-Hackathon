package com.hackathon.mathportal.modules.Estadistica;

import com.hackathon.mathportal.common.PageResponse;
import com.hackathon.mathportal.modules.Estadistica.EstadisticasDtos.*;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/estadisticas")
public class EstadisticasController {
    private final EstadisticasService service;

    public EstadisticasController(EstadisticasService service) { this.service = service; }

    @GetMapping("/me")
    public Resumen propias() { return service.propias(); }

    @GetMapping("/me/desafios")
    public PageResponse<Map<String, Object>> desafios(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.historialPropio(EstadisticasRepository.Historial.DESAFIOS, page, size);
    }

    @GetMapping("/me/historial/niveles")
    public PageResponse<Map<String, Object>> niveles(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.historialPropio(EstadisticasRepository.Historial.NIVELES, page, size);
    }

    @GetMapping("/me/historial/errores")
    public PageResponse<Map<String, Object>> errores(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.historialPropio(EstadisticasRepository.Historial.ERRORES, page, size);
    }

    @PutMapping("/me/partidas/{partidaId}/tiempo")
    public Tiempo tiempo(@PathVariable UUID partidaId, @Valid @RequestBody RegistrarTiempo request) {
        return service.registrarTiempo(partidaId, request);
    }

    @GetMapping("/profesor/alumnos")
    public PageResponse<Map<String, Object>> alumnos(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.alumnos(page, size);
    }

    @GetMapping("/profesor/alumnos/{alumnoId}")
    public Resumen alumno(@PathVariable UUID alumnoId) { return service.alumno(alumnoId); }

    @GetMapping("/profesor/alumnos/{alumnoId}/desafios")
    public PageResponse<Map<String, Object>> desafiosAlumno(@PathVariable UUID alumnoId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.historialAlumno(alumnoId, EstadisticasRepository.Historial.DESAFIOS, page, size);
    }

    @GetMapping("/profesor/alumnos/{alumnoId}/historial/niveles")
    public PageResponse<Map<String, Object>> nivelesAlumno(@PathVariable UUID alumnoId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.historialAlumno(alumnoId, EstadisticasRepository.Historial.NIVELES, page, size);
    }

    @GetMapping("/profesor/alumnos/{alumnoId}/historial/errores")
    public PageResponse<Map<String, Object>> erroresAlumno(@PathVariable UUID alumnoId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.historialAlumno(alumnoId, EstadisticasRepository.Historial.ERRORES, page, size);
    }
}