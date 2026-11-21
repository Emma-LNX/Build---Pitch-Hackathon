REVOKE ALL ON ALL TABLES IN SCHEMA math_portal FROM PUBLIC;

ALTER TABLE math_portal.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.niveles_alumno ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.actividad_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.progreso_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.movimientos_puntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.dias_aprendizaje ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON math_portal.alumnos, math_portal.niveles_alumno,
                math_portal.temas, math_portal.actividades, math_portal.actividad_versiones,
                math_portal.partidas, math_portal.progreso_actividades,
                math_portal.movimientos_puntos, math_portal.dias_aprendizaje FROM %I', client_role);
        END IF;
    END LOOP;
END;
$$;
