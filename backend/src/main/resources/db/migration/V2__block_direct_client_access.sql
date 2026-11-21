-- This schema is private to the Spring API. No direct Supabase browser CRUD.
-- The backend's PostgreSQL owner connection bypasses RLS, so every API query also checks membership.
REVOKE ALL ON SCHEMA math_portal FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA math_portal FROM PUBLIC, anon, authenticated;
ALTER TABLE math_portal.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.course_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.topics ENABLE ROW LEVEL SECURITY;
-- No client policies: deny by default. Provision memberships through trusted SQL only.
