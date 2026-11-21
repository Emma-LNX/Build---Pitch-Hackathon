CREATE TABLE math_portal.alumnos (
    id UUID PRIMARY KEY,
    auth_subject VARCHAR(255) NOT NULL UNIQUE,
    alias VARCHAR(40) NOT NULL,
    avatar_clave VARCHAR(100),
    grado_escolar VARCHAR(30),
    zona_horaria VARCHAR(100) DEFAULT 'America/Guatemala' NOT NULL,
    participa_ranking BOOLEAN DEFAULT FALSE NOT NULL,
    estado VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (
    id UUID PRIMARY KEY, email VARCHAR(254), email_confirmed_at TIMESTAMP WITH TIME ZONE
);
