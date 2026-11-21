REVOKE ALL ON TABLE math_portal.classrooms, math_portal.classroom_students FROM PUBLIC, anon, authenticated;
ALTER TABLE math_portal.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE math_portal.classroom_students ENABLE ROW LEVEL SECURITY;
