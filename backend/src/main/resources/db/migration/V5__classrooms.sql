CREATE TABLE math_portal.classrooms (
    id UUID PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES math_portal.schools(id) ON DELETE CASCADE,
    grade VARCHAR(80) NOT NULL CHECK (TRIM(grade) <> '' AND grade = UPPER(TRIM(grade))),
    section VARCHAR(16) NOT NULL CHECK (TRIM(section) <> '' AND section = UPPER(TRIM(section))),
    academic_year INTEGER NOT NULL CHECK (academic_year BETWEEN 1 AND 9999),
    teacher_id UUID NOT NULL,
    teacher_role VARCHAR(16) NOT NULL DEFAULT 'PROFESOR' CHECK (teacher_role = 'PROFESOR'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (school_id, id, academic_year),
    UNIQUE (school_id, academic_year, grade, section),
    FOREIGN KEY (school_id, teacher_id, teacher_role)
        REFERENCES math_portal.school_memberships(school_id, user_id, role)
);
CREATE INDEX classrooms_by_teacher ON math_portal.classrooms(school_id, teacher_id, academic_year);

CREATE TABLE math_portal.classroom_students (
    school_id UUID NOT NULL,
    classroom_id UUID NOT NULL,
    academic_year INTEGER NOT NULL,
    student_id UUID NOT NULL,
    student_role VARCHAR(16) NOT NULL DEFAULT 'ALUMNO' CHECK (student_role = 'ALUMNO'),
    enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (school_id, classroom_id, student_id),
    UNIQUE (school_id, academic_year, student_id),
    FOREIGN KEY (school_id, classroom_id, academic_year)
        REFERENCES math_portal.classrooms(school_id, id, academic_year) ON DELETE CASCADE,
    FOREIGN KEY (school_id, student_id, student_role)
        REFERENCES math_portal.school_memberships(school_id, user_id, role) ON DELETE CASCADE
);
