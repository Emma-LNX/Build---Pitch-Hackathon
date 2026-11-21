CREATE TABLE alumnos (
    id uuid PRIMARY KEY,
    auth_subject varchar(255) NOT NULL UNIQUE,
    alias varchar(40) NOT NULL CHECK (length(trim(alias)) > 0),
    avatar_clave varchar(100),
    grado_escolar varchar(30),
    zona_horaria varchar(100) NOT NULL DEFAULT 'America/Guatemala',
    participa_ranking boolean NOT NULL DEFAULT false,
    estado varchar(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    creado_en timestamptz NOT NULL,
    actualizado_en timestamptz NOT NULL
);

CREATE TABLE niveles_alumno (
    id uuid PRIMARY KEY,
    numero integer NOT NULL UNIQUE CHECK (numero > 0),
    nombre varchar(80) NOT NULL,
    xp_minimos bigint NOT NULL UNIQUE CHECK (xp_minimos >= 0)
);

CREATE TABLE temas (
    id uuid PRIMARY KEY,
    nombre varchar(120) NOT NULL,
    orden integer NOT NULL CHECK (orden >= 0),
    activo boolean NOT NULL DEFAULT true
);

CREATE TABLE actividades (
    id uuid PRIMARY KEY,
    tema_id uuid NOT NULL REFERENCES temas(id),
    titulo varchar(160) NOT NULL,
    tipo_juego varchar(40) NOT NULL CHECK (tipo_juego IN ('OPCION_MULTIPLE')),
    orden integer NOT NULL CHECK (orden >= 0),
    activa boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_actividades_tema ON actividades(tema_id, orden);

CREATE TABLE actividad_versiones (
    id uuid PRIMARY KEY,
    actividad_id uuid NOT NULL REFERENCES actividades(id),
    numero_version integer NOT NULL CHECK (numero_version > 0),
    dificultad varchar(30) NOT NULL,
    contenido jsonb NOT NULL,
    reglas_evaluacion jsonb NOT NULL,
    xp_recompensa integer NOT NULL CHECK (xp_recompensa >= 0),
    publicada_en timestamptz NOT NULL,
    UNIQUE (actividad_id, numero_version)
);

CREATE FUNCTION impedir_cambio_version_publicada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Las versiones publicadas son inmutables; crear una nueva version';
END;
$$;
CREATE TRIGGER actividad_version_inmutable BEFORE UPDATE OR DELETE ON actividad_versiones
    FOR EACH ROW EXECUTE FUNCTION impedir_cambio_version_publicada();

CREATE TABLE partidas (
    id uuid PRIMARY KEY,
    alumno_id uuid NOT NULL REFERENCES alumnos(id),
    actividad_version_id uuid NOT NULL REFERENCES actividad_versiones(id),
    respuestas jsonb NOT NULL,
    puntaje_porcentaje numeric(5,2) NOT NULL CHECK (puntaje_porcentaje BETWEEN 0 AND 100),
    aprobada boolean NOT NULL,
    origen varchar(10) NOT NULL CHECK (origen IN ('ONLINE', 'OFFLINE')),
    finalizada_cliente_en timestamptz,
    recibida_en timestamptz NOT NULL,
    fecha_aprendizaje date NOT NULL,
    zona_horaria_aplicada varchar(100) NOT NULL
);
CREATE INDEX idx_partidas_alumno_fecha ON partidas(alumno_id, recibida_en DESC, id);
CREATE INDEX idx_partidas_version ON partidas(actividad_version_id);

CREATE TABLE progreso_actividades (
    alumno_id uuid NOT NULL REFERENCES alumnos(id),
    actividad_id uuid NOT NULL REFERENCES actividades(id),
    intentos integer NOT NULL CHECK (intentos > 0),
    mejor_puntaje numeric(5,2) NOT NULL CHECK (mejor_puntaje BETWEEN 0 AND 100),
    primera_aprobacion_en timestamptz,
    ultima_partida_en timestamptz NOT NULL,
    PRIMARY KEY (alumno_id, actividad_id)
);
CREATE INDEX idx_progreso_actividad ON progreso_actividades(actividad_id);

CREATE TABLE movimientos_puntos (
    id uuid PRIMARY KEY,
    alumno_id uuid NOT NULL REFERENCES alumnos(id),
    actividad_id uuid NOT NULL REFERENCES actividades(id),
    partida_id uuid NOT NULL UNIQUE REFERENCES partidas(id),
    cantidad integer NOT NULL CHECK (cantidad > 0),
    otorgado_en timestamptz NOT NULL,
    UNIQUE (alumno_id, actividad_id)
);
CREATE INDEX idx_puntos_actividad ON movimientos_puntos(actividad_id);

CREATE TABLE dias_aprendizaje (
    alumno_id uuid NOT NULL REFERENCES alumnos(id),
    fecha date NOT NULL,
    primera_partida_id uuid NOT NULL UNIQUE REFERENCES partidas(id),
    creado_en timestamptz NOT NULL,
    PRIMARY KEY (alumno_id, fecha)
);

INSERT INTO niveles_alumno (id, numero, nombre, xp_minimos) VALUES
 ('00000000-0000-0000-0000-000000000001', 1, 'Explorador', 0),
 ('00000000-0000-0000-0000-000000000002', 2, 'Aprendiz', 100),
 ('00000000-0000-0000-0000-000000000003', 3, 'Aventurero', 250);
