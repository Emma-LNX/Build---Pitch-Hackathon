-- This schema is private to the Spring API. No direct Supabase browser CRUD.
-- The backend's PostgreSQL owner connection bypasses RLS, so every API query also checks membership.
REVOKE ALL ON SCHEMA math_portal FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA math_portal FROM PUBLIC;
ALTER TABLE math_portal.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.course_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.topics ENABLE ROW LEVEL SECURITY;
-- No client policies: deny by default. Provision memberships through trusted SQL only.

DO $$
DECLARE client_role text;
BEGIN
 FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA math_portal FROM %I', client_role);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA math_portal FROM %I', client_role);
  END IF;
 END LOOP;
END;
$$;
