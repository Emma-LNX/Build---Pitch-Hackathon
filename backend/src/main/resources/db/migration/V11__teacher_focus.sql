CREATE TABLE math_portal.teacher_focus_topics (
    school_id uuid NOT NULL,
    classroom_id uuid NOT NULL,
    student_id uuid NOT NULL,
    topic_id uuid NOT NULL REFERENCES math_portal.temas(id),
    selected_by uuid NOT NULL,
    selected_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (school_id, classroom_id, student_id, topic_id),
    FOREIGN KEY (school_id, classroom_id, student_id)
        REFERENCES math_portal.classroom_students(school_id, classroom_id, student_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_teacher_focus_student ON math_portal.teacher_focus_topics(student_id, topic_id);
