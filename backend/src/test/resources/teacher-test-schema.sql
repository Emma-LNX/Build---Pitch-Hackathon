CREATE TABLE math_portal.alumnos (
    id UUID PRIMARY KEY, auth_subject VARCHAR(255) UNIQUE NOT NULL,
    alias VARCHAR(40) NOT NULL, estado VARCHAR(20) NOT NULL
);
CREATE TABLE math_portal.temas (
    id UUID PRIMARY KEY, nombre VARCHAR(120) NOT NULL, activo BOOLEAN NOT NULL
);
CREATE TABLE math_portal.actividades (
    id UUID PRIMARY KEY, tema_id UUID NOT NULL REFERENCES math_portal.temas(id)
);
CREATE TABLE math_portal.actividad_versiones (
    id UUID PRIMARY KEY, actividad_id UUID NOT NULL REFERENCES math_portal.actividades(id)
);
CREATE TABLE math_portal.partidas (
    id UUID PRIMARY KEY, alumno_id UUID NOT NULL REFERENCES math_portal.alumnos(id),
    actividad_version_id UUID NOT NULL REFERENCES math_portal.actividad_versiones(id),
    puntaje_porcentaje NUMERIC(5,2) NOT NULL, aprobada BOOLEAN NOT NULL,
    recibida_en TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE TABLE math_portal.teacher_focus_topics (
    school_id UUID NOT NULL, classroom_id UUID NOT NULL, student_id UUID NOT NULL,
    topic_id UUID NOT NULL REFERENCES math_portal.temas(id),
    selected_by UUID NOT NULL,
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (school_id, classroom_id, student_id, topic_id),
    FOREIGN KEY (school_id, classroom_id, student_id)
        REFERENCES math_portal.classroom_students(school_id, classroom_id, student_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
