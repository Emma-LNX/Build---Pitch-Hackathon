REVOKE ALL ON ALL TABLES IN SCHEMA math_portal FROM PUBLIC, anon, authenticated;
ALTER TABLE math_portal.director_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.school_directors ENABLE ROW LEVEL SECURITY;
