CREATE TABLE math_portal.parent_contacts (
    id UUID PRIMARY KEY,
    school_id UUID NOT NULL,
    classroom_id UUID NOT NULL,
    student_id UUID NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    relationship VARCHAR(40) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(30),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_report_sent_at TIMESTAMP WITH TIME ZONE,
    weekly_claimed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (school_id, classroom_id, student_id, email),
    FOREIGN KEY (school_id, classroom_id, student_id)
        REFERENCES math_portal.classroom_students(school_id, classroom_id, student_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
