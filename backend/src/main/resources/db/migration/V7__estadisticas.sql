-- Historial propio del modulo. Se mantiene la conexion y el esquema existentes.
CREATE TABLE math_portal.estadistica_respuestas (
    partida_id uuid NOT NULL REFERENCES math_portal.partidas(id) ON DELETE CASCADE,
    pregunta_id varchar(80) NOT NULL,
    respuesta_elegida varchar(80),
    correcta boolean NOT NULL,
    PRIMARY KEY (partida_id, pregunta_id)
);

-- No se rellenan tiempos anteriores: no es posible deducirlos de recibida_en.
CREATE TABLE math_portal.estadistica_tiempos (
    partida_id uuid PRIMARY KEY REFERENCES math_portal.partidas(id) ON DELETE CASCADE,
    iniciada_en timestamptz NOT NULL,
    finalizada_en timestamptz NOT NULL,
    tiempo_activo_ms bigint NOT NULL CHECK (tiempo_activo_ms >= 0),
    tiempo_transcurrido_ms bigint GENERATED ALWAYS AS
        ((extract(epoch FROM (finalizada_en - iniciada_en)) * 1000)::bigint) STORED,
    fuente varchar(30) NOT NULL DEFAULT 'CLIENTE' CHECK (fuente = 'CLIENTE'),
    registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (finalizada_en >= iniciada_en),
    CHECK (tiempo_activo_ms <= tiempo_transcurrido_ms)
);

CREATE TABLE math_portal.estadistica_niveles (
    partida_id uuid PRIMARY KEY REFERENCES math_portal.partidas(id) ON DELETE CASCADE,
    alumno_id uuid NOT NULL REFERENCES math_portal.alumnos(id) ON DELETE CASCADE,
    registrado_en timestamptz NOT NULL,
    xp_total bigint NOT NULL CHECK (xp_total >= 0),
    nivel_numero integer NOT NULL,
    nivel_nombre varchar(80) NOT NULL,
    reconstruido boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_estadistica_niveles_alumno
    ON math_portal.estadistica_niveles(alumno_id, registrado_en DESC, xp_total DESC, partida_id);

-- Todas las preguntas, incluidas las omitidas. No se expone la clave de respuestas.
INSERT INTO math_portal.estadistica_respuestas (partida_id, pregunta_id, respuesta_elegida, correcta)
SELECT p.id, q.value->>'id', p.respuestas->>(q.value->>'id'),
    coalesce(p.respuestas->>(q.value->>'id') =
        v.reglas_evaluacion->'correctAnswers'->>(q.value->>'id'), false)
FROM math_portal.partidas p
JOIN math_portal.actividad_versiones v ON v.id = p.actividad_version_id
CROSS JOIN LATERAL jsonb_array_elements(v.contenido->'questions') q(value);

-- Reconstruccion determinista con los umbrales actuales; se marca explicitamente.
WITH acumulados AS (
    SELECT partida_id, alumno_id, otorgado_en,
        sum(cantidad) OVER (PARTITION BY alumno_id ORDER BY otorgado_en, id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS xp_total
    FROM math_portal.movimientos_puntos
)
INSERT INTO math_portal.estadistica_niveles
    (partida_id, alumno_id, registrado_en, xp_total, nivel_numero, nivel_nombre, reconstruido)
SELECT m.partida_id, m.alumno_id, m.otorgado_en, m.xp_total, n.numero, n.nombre, true
FROM acumulados m
CROSS JOIN LATERAL (
    SELECT numero, nombre FROM math_portal.niveles_alumno
    WHERE xp_minimos <= m.xp_total ORDER BY xp_minimos DESC LIMIT 1
) n;

-- Los triggers participan en la transaccion original: rollback y reintentos no duplican historia.
-- Permiten integrar el modulo sin modificar el servicio existente de partidas.
CREATE FUNCTION math_portal.estadistica_capturar_respuestas() RETURNS trigger
LANGUAGE plpgsql SET search_path = math_portal, pg_temp AS $$
BEGIN
    INSERT INTO math_portal.estadistica_respuestas (partida_id, pregunta_id, respuesta_elegida, correcta)
    SELECT NEW.id, q.value->>'id', NEW.respuestas->>(q.value->>'id'),
        coalesce(NEW.respuestas->>(q.value->>'id') =
            v.reglas_evaluacion->'correctAnswers'->>(q.value->>'id'), false)
    FROM math_portal.actividad_versiones v
    CROSS JOIN LATERAL jsonb_array_elements(v.contenido->'questions') q(value)
    WHERE v.id = NEW.actividad_version_id;
    RETURN NEW;
END;
$$;
CREATE TRIGGER estadistica_respuestas_insert AFTER INSERT ON math_portal.partidas
    FOR EACH ROW EXECUTE FUNCTION math_portal.estadistica_capturar_respuestas();

CREATE FUNCTION math_portal.estadistica_capturar_nivel() RETURNS trigger
LANGUAGE plpgsql SET search_path = math_portal, pg_temp AS $$
DECLARE xp bigint;
BEGIN
    -- El flujo de partidas ya bloquea al alumno; mantener tambien esta garantia aqui.
    PERFORM id FROM math_portal.alumnos WHERE id = NEW.alumno_id FOR UPDATE;
    SELECT coalesce(sum(cantidad), 0) INTO xp
        FROM math_portal.movimientos_puntos WHERE alumno_id = NEW.alumno_id;
    INSERT INTO math_portal.estadistica_niveles
        (partida_id, alumno_id, registrado_en, xp_total, nivel_numero, nivel_nombre)
    SELECT NEW.partida_id, NEW.alumno_id, NEW.otorgado_en, xp, numero, nombre
        FROM math_portal.niveles_alumno WHERE xp_minimos <= xp
        ORDER BY xp_minimos DESC LIMIT 1;
    RETURN NEW;
END;
$$;
CREATE TRIGGER estadistica_niveles_insert AFTER INSERT ON math_portal.movimientos_puntos
    FOR EACH ROW EXECUTE FUNCTION math_portal.estadistica_capturar_nivel();

ALTER TABLE math_portal.estadistica_respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.estadistica_tiempos ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.estadistica_niveles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON math_portal.estadistica_respuestas, math_portal.estadistica_tiempos,
    math_portal.estadistica_niveles FROM PUBLIC;
REVOKE ALL ON FUNCTION math_portal.estadistica_capturar_respuestas(),
    math_portal.estadistica_capturar_nivel() FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON math_portal.estadistica_respuestas,
                math_portal.estadistica_tiempos, math_portal.estadistica_niveles FROM %I', client_role);
            EXECUTE format('REVOKE ALL ON FUNCTION math_portal.estadistica_capturar_respuestas(),
                math_portal.estadistica_capturar_nivel() FROM %I', client_role);
        END IF;
    END LOOP;
END;
$$;