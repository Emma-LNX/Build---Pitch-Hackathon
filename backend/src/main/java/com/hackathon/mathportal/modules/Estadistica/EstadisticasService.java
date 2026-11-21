package com.hackathon.mathportal.modules.Estadistica;

import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class EstadisticasService {

    private final EstadisticasRepository estadisticasRepository;

    public EstadisticasService(
            EstadisticasRepository estadisticasRepository) {
        this.estadisticasRepository = estadisticasRepository;
    }

    public boolean comprobarConexion() {
        return estadisticasRepository.comprobarConexion();
    }

    public double calcularPorcentajeAciertos(
            int respuestasCorrectas,
            int totalPreguntas) {

        if (totalPreguntas <= 0) {
            throw new IllegalArgumentException(
                "El total de preguntas debe ser mayor que cero"
            );
        }

        if (respuestasCorrectas < 0
                || respuestasCorrectas > totalPreguntas) {
            throw new IllegalArgumentException(
                "La cantidad de respuestas correctas es invalida"
            );
        }

        return respuestasCorrectas * 100.0 / totalPreguntas;
    }

    public double calcularPorcentajeError(
            int respuestasCorrectas,
            int totalPreguntas) {

        return 100.0 - calcularPorcentajeAciertos(
            respuestasCorrectas,
            totalPreguntas
        );
    }

    public double calcularTiempoPromedio(
            List<Integer> tiemposSegundos) {

        if (tiemposSegundos == null || tiemposSegundos.isEmpty()) {
            throw new IllegalArgumentException(
                "Se necesita al menos un tiempo registrado"
            );
        }

        double suma = 0;

        for (Integer tiempo : tiemposSegundos) {
            if (tiempo == null || tiempo < 0) {
                throw new IllegalArgumentException(
                    "Los tiempos deben ser valores no negativos"
                );
            }

            suma += tiempo;
        }

        return suma / tiemposSegundos.size();
    }
}