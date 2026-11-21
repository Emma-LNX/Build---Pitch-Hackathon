CREATE TABLE math_portal.schools (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL CHECK (TRIM(name) <> '')
);

-- user_id is the verified Supabase Auth JWT sub, never a value supplied in a request body.
CREATE TABLE math_portal.school_memberships (
    school_id UUID NOT NULL REFERENCES math_portal.schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(16) NOT NULL CHECK (role IN ('PROFESOR', 'ALUMNO')),
    PRIMARY KEY (school_id, user_id),
    UNIQUE (school_id, user_id, role)
);
CREATE INDEX school_memberships_by_user ON math_portal.school_memberships(user_id, school_id);

CREATE TABLE math_portal.courses (
    id UUID PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES math_portal.schools(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL CHECK (TRIM(name) <> ''),
    UNIQUE (school_id, id)
);

-- Both assigned teachers and enrolled students use this table.
-- Composite foreign keys prohibit mixing schools and changing a role through course assignment.
CREATE TABLE math_portal.course_memberships (
    school_id UUID NOT NULL,
    course_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(16) NOT NULL,
    PRIMARY KEY (school_id, course_id, user_id),
    FOREIGN KEY (school_id, course_id)
        REFERENCES math_portal.courses(school_id, id) ON DELETE CASCADE,
    FOREIGN KEY (school_id, user_id, role)
        REFERENCES math_portal.school_memberships(school_id, user_id, role) ON DELETE CASCADE
);
CREATE INDEX course_memberships_by_user ON math_portal.course_memberships(user_id, school_id, course_id);

CREATE TABLE math_portal.topics (
    id UUID PRIMARY KEY,
    school_id UUID NOT NULL,
    course_id UUID NOT NULL,
    title VARCHAR(160) NOT NULL CHECK (TRIM(title) <> ''),
    content VARCHAR(20000) NOT NULL CHECK (TRIM(content) <> ''),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id, course_id)
        REFERENCES math_portal.courses(school_id, id) ON DELETE CASCADE
);
CREATE INDEX topics_by_course ON math_portal.topics(school_id, course_id, created_at, id);
