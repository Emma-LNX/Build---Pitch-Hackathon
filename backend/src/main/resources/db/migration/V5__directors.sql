CREATE TABLE math_portal.director_accounts (
    user_id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (TRIM(name) <> ''),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE math_portal.school_directors (
    school_id UUID PRIMARY KEY REFERENCES math_portal.schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES math_portal.director_accounts(user_id)
);
CREATE INDEX school_directors_by_user ON math_portal.school_directors(user_id, school_id);
