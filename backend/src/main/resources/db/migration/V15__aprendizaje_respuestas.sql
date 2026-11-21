-- Respuestas de los retos que la app genera en el dispositivo (aprendizaje adaptativo).
-- El id lo crea el cliente: un reenvío del mismo lote no duplica filas.
CREATE TABLE math_portal.aprendizaje_respuestas (
    id uuid PRIMARY KEY,
    alumno_id uuid NOT NULL REFERENCES math_portal.alumnos(id) ON DELETE CASCADE,
    sesion_id uuid NOT NULL,
    origen varchar(20) NOT NULL,
    categoria varchar(30) NOT NULL,
    ejercicio varchar(40) NOT NULL,
    dificultad smallint NOT NULL CHECK (dificultad BETWEEN 1 AND 3),
    interaccion varchar(20) NOT NULL,
    correcta boolean NOT NULL,
    error_tag varchar(40),
    tiempo_ms bigint NOT NULL CHECK (tiempo_ms >= 0),
    respondida_en timestamptz NOT NULL,
    recibida_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_aprendizaje_respuestas_alumno
    ON math_portal.aprendizaje_respuestas(alumno_id, respondida_en);

REVOKE ALL ON TABLE math_portal.aprendizaje_respuestas FROM PUBLIC;
ALTER TABLE math_portal.aprendizaje_respuestas ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON math_portal.aprendizaje_respuestas FROM %I', client_role);
        END IF;
    END LOOP;
END;
$$;
