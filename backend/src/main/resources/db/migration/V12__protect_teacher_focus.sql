REVOKE ALL ON TABLE math_portal.teacher_focus_topics FROM PUBLIC;
ALTER TABLE math_portal.teacher_focus_topics ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE client_role text;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON math_portal.teacher_focus_topics FROM %I', client_role);
        END IF;
    END LOOP;
END;
$$;
