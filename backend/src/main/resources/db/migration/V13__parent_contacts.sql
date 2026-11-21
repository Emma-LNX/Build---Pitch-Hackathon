CREATE TABLE math_portal.parent_contacts (
    id uuid PRIMARY KEY,
    school_id uuid NOT NULL,
    classroom_id uuid NOT NULL,
    student_id uuid NOT NULL,
    full_name varchar(120) NOT NULL CHECK (TRIM(full_name) <> ''),
    relationship varchar(40) NOT NULL CHECK (TRIM(relationship) <> ''),
    email varchar(254) NOT NULL CHECK (TRIM(email) <> '' AND email = LOWER(email)),
    phone varchar(30),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_report_sent_at timestamptz,
    UNIQUE (school_id, classroom_id, student_id, email),
    FOREIGN KEY (school_id, classroom_id, student_id)
        REFERENCES math_portal.classroom_students(school_id, classroom_id, student_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_parent_contacts_student
    ON math_portal.parent_contacts(school_id, classroom_id, student_id);

REVOKE ALL ON TABLE math_portal.parent_contacts FROM PUBLIC;
ALTER TABLE math_portal.parent_contacts ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON math_portal.parent_contacts FROM %I', client_role);
        END IF;
    END LOOP;
END;
$$;
