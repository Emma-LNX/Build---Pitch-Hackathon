REVOKE ALL ON TABLE teacher_focus_topics FROM PUBLIC, anon, authenticated;
ALTER TABLE teacher_focus_topics ENABLE ROW LEVEL SECURITY;
