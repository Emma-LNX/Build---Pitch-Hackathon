ALTER TABLE math_portal.parent_contacts
    ADD COLUMN weekly_claimed_at timestamptz;

CREATE INDEX idx_parent_contacts_weekly_due
    ON math_portal.parent_contacts(last_report_sent_at, id);
