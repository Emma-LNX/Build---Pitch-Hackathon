INSERT INTO temas (id, nombre, orden, activo)
VALUES ('10000000-0000-0000-0000-000000000001', 'Sumas', 1, true);

INSERT INTO actividades (id, tema_id, titulo, tipo_juego, orden, activa)
VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'Primeras sumas', 'OPCION_MULTIPLE', 1, true);

INSERT INTO actividad_versiones
 (id, actividad_id, numero_version, dificultad, contenido, reglas_evaluacion, xp_recompensa, publicada_en)
VALUES (
 '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'INICIAL',
 '{"questions":[
   {"id":"q1","text":"¿Cuánto es 2 + 3?","options":[{"id":"a","text":"4"},{"id":"b","text":"5"},{"id":"c","text":"6"}]},
   {"id":"q2","text":"¿Cuánto es 4 + 4?","options":[{"id":"a","text":"8"},{"id":"b","text":"7"},{"id":"c","text":"9"}]}
 ]}',
 '{"passingPercentage":50,"correctAnswers":{"q1":"b","q2":"a"}}', 50, CURRENT_TIMESTAMP
);
