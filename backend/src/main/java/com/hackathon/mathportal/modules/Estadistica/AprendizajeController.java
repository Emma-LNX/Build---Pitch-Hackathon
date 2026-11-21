package com.hackathon.mathportal.modules.Estadistica;

import com.hackathon.mathportal.modules.Estadistica.AprendizajeDtos.*;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/estadisticas")
public class AprendizajeController {
    private final AprendizajeService service;

    public AprendizajeController(AprendizajeService service) { this.service = service; }

    @PostMapping("/me/respuestas")
    public Guardadas guardar(@Valid @RequestBody Lote lote) { return service.guardar(lote); }

    @GetMapping("/me/dominio")
    public Dominio propio() { return service.propio(); }

    @GetMapping("/profesor/alumnos/{alumnoId}/dominio")
    public Dominio alumno(@PathVariable UUID alumnoId) { return service.alumno(alumnoId); }

    @GetMapping("/profesor/aulas/{classroomId}")
    public Aula aula(@PathVariable UUID classroomId) { return service.aula(classroomId); }
}
