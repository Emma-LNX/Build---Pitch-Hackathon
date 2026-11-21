package com.hackathon.mathportal.modules.Estadistica;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
@RequestMapping("/api/estadisticas")
public class EstadisticasController {

    private final EstadisticasService estadisticasService;

    public EstadisticasController(
            EstadisticasService estadisticasService) {
        this.estadisticasService = estadisticasService;
    }

    @GetMapping("/prueba")
    public Map<String, Boolean> probar() {
        boolean conexionCorrecta =
            estadisticasService.comprobarConexion();

        return Map.of("conexionBaseDeDatos", conexionCorrecta);
    }
}