REVOKE ALL ON TABLE alumnos, niveles_alumno, temas, actividades, actividad_versiones,
    partidas, progreso_actividades, movimientos_puntos, dias_aprendizaje
    FROM PUBLIC, anon, authenticated;

ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE niveles_alumno ENABLE ROW LEVEL SECURITY;
ALTER TABLE temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividad_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE progreso_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_puntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dias_aprendizaje ENABLE ROW LEVEL SECURITY;
