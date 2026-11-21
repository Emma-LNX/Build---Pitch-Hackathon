-- Cuentas de estudiante creadas por su profesor (usuario + contraseña).
-- La contraseña NUNCA se guarda aquí: vive solo en Supabase Auth (con hash).
-- user_id es el id del usuario de Supabase Auth creado por el backend.
CREATE TABLE math_portal.student_accounts (
    user_id UUID PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    username_normalized VARCHAR(30) NOT NULL UNIQUE,
    display_name VARCHAR(40) NOT NULL CHECK (TRIM(display_name) <> ''),
    school_id UUID NOT NULL,
    course_id UUID NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    password_reset_at TIMESTAMP WITH TIME ZONE,
    -- Cada cuenta pertenece a una sola clase de su colegio.
    FOREIGN KEY (school_id, course_id) REFERENCES math_portal.courses(school_id, id)
);
CREATE INDEX student_accounts_by_course ON math_portal.student_accounts(school_id, course_id, display_name);

-- Género elegido por el estudiante para su avatar. No interviene en el acceso.
ALTER TABLE math_portal.alumnos ADD COLUMN genero VARCHAR(4);
ALTER TABLE math_portal.alumnos ADD CONSTRAINT alumnos_genero_valido CHECK (genero IS NULL OR genero IN ('NINA', 'NINO'));
