REVOKE ALL ON TABLE math_portal.classrooms, math_portal.classroom_students FROM PUBLIC;
ALTER TABLE math_portal.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.classroom_students ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON math_portal.classrooms, math_portal.classroom_students FROM %I', client_role);
        END IF;
    END LOOP;
END;
$$;
