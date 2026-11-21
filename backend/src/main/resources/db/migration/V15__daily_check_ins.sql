CREATE TABLE math_portal.registros_diarios (
    alumno_id uuid NOT NULL REFERENCES math_portal.alumnos(id),
    fecha date NOT NULL,
    horas_sueno numeric(3,1) CHECK (horas_sueno BETWEEN 0 AND 24),
    alimentacion varchar(30) NOT NULL CHECK (alimentacion IN
        ('SUFICIENTE', 'POCO', 'NO_HE_COMIDO', 'PREFIERO_NO_RESPONDER')),
    estado_animo varchar(30) NOT NULL CHECK (estado_animo IN
        ('FELIZ', 'TRANQUILO', 'TRISTE', 'PREOCUPADO', 'CANSADO', 'PREFIERO_NO_RESPONDER')),
    zona_horaria varchar(100) NOT NULL,
    creado_en timestamptz NOT NULL,
    PRIMARY KEY (alumno_id, fecha)
);

ALTER TABLE math_portal.registros_diarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON math_portal.registros_diarios FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON math_portal.registros_diarios FROM %I', client_role);
        END IF;
    END LOOP;
END;
$$;
