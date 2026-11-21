package com.hackathon.mathportal.modules.directors.service;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import com.hackathon.mathportal.modules.auth.dto.SchoolRole;
import com.hackathon.mathportal.modules.courses.dto.CourseView;
import com.hackathon.mathportal.modules.schools.dto.SchoolView;
import com.hackathon.mathportal.modules.directors.dto.DirectorDtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class DirectorService {
    private final JdbcTemplate jdbc;
    public DirectorService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public DirectorProfile register(UUID actor, RegisterDirector request) {
        String email = verifiedEmail(actor);
        var existing = profileRows(actor, email);
        if (!existing.isEmpty()) return existing.getFirst();
        jdbc.update("INSERT INTO math_portal.director_accounts (user_id, name) VALUES (?, ?)", actor, request.name().strip());
        return new DirectorProfile(actor, request.name().strip(), email);
    }

    public DirectorProfile profile(UUID actor) {
        String email = verifiedEmail(actor);
        return profileRows(actor, email).stream().findFirst().orElseThrow(DirectorService::notFound);
    }

    public SchoolView createSchool(UUID actor, NameRequest request) {
        profile(actor);
        UUID school = UUID.randomUUID();
        jdbc.update("INSERT INTO math_portal.schools (id, name) VALUES (?, ?)", school, request.name().strip());
        jdbc.update("INSERT INTO math_portal.school_directors (school_id, user_id) VALUES (?, ?)", school, actor);
        return new SchoolView(school, request.name().strip(), SchoolRole.DIRECTOR);
    }

    public List<Member> members(UUID actor, UUID school) {
        requireOwner(actor, school);
        return memberRows(school, null);
    }

    public Member addMember(UUID actor, UUID school, AddMember request) {
        requireOwner(actor, school);
        if (request.role() == SchoolRole.DIRECTOR) throw badRequest("Solo puedes asignar profesores o alumnos");
        var targets = jdbc.query("SELECT id FROM auth.users WHERE LOWER(email) = ? AND email_confirmed_at IS NOT NULL",
            (rs, row) -> rs.getObject("id", UUID.class), request.email().strip().toLowerCase(Locale.ROOT));
        if (targets.size() != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No hay una cuenta con ese correo confirmado");
        UUID target = targets.getFirst();
        if (target.equals(actor)) throw badRequest("Tu cuenta ya administra este colegio");
        var existing = memberRows(school, target);
        if (!existing.isEmpty()) {
            if (existing.getFirst().role() != request.role()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "La cuenta ya tiene otro rol en este colegio");
            }
            return existing.getFirst();
        }
        jdbc.update("INSERT INTO math_portal.school_memberships (school_id, user_id, role) VALUES (?, ?, ?)", school, target, request.role().name());
        return memberRows(school, target).getFirst();
    }

    public void removeMember(UUID actor, UUID school, UUID user) {
        requireOwner(actor, school);
        if (jdbc.update("DELETE FROM math_portal.school_memberships WHERE school_id = ? AND user_id = ?", school, user) == 0) throw notFound();
    }

    public CourseView createCourse(UUID actor, UUID school, NameRequest request) {
        requireOwner(actor, school);
        UUID course = UUID.randomUUID();
        jdbc.update("INSERT INTO math_portal.courses (id, school_id, name) VALUES (?, ?, ?)", course, school, request.name().strip());
        return new CourseView(course, school, request.name().strip());
    }

    public void removeCourse(UUID actor, UUID school, UUID course) {
        requireOwner(actor, school);
        if (jdbc.update("DELETE FROM math_portal.courses WHERE school_id = ? AND id = ?", school, course) == 0) throw notFound();
    }

    public List<Member> courseMembers(UUID actor, UUID school, UUID course) {
        requireOwner(actor, school);
        requireCourse(school, course);
        return jdbc.query("""
            SELECT m.user_id, u.email, m.role FROM math_portal.course_memberships m
            LEFT JOIN auth.users u ON u.id = m.user_id
            WHERE m.school_id = ? AND m.course_id = ? ORDER BY u.email, m.user_id
            """, (rs, row) -> new Member(rs.getObject("user_id", UUID.class), rs.getString("email"),
                SchoolRole.valueOf(rs.getString("role"))), school, course);
    }

    public void assignCourseMember(UUID actor, UUID school, UUID course, UUID user) {
        requireOwner(actor, school);
        requireCourse(school, course);
        var target = memberRows(school, user).stream().findFirst().orElseThrow(DirectorService::notFound);
        int existing = jdbc.queryForObject("SELECT COUNT(*) FROM math_portal.course_memberships WHERE school_id = ? AND course_id = ? AND user_id = ?", Integer.class, school, course, user);
        if (existing == 0) jdbc.update("INSERT INTO math_portal.course_memberships (school_id, course_id, user_id, role) VALUES (?, ?, ?, ?)", school, course, user, target.role().name());
    }

    public void removeCourseMember(UUID actor, UUID school, UUID course, UUID user) {
        requireOwner(actor, school);
        requireCourse(school, course);
        if (jdbc.update("DELETE FROM math_portal.course_memberships WHERE school_id = ? AND course_id = ? AND user_id = ?", school, course, user) == 0) throw notFound();
    }

    public Statistics statistics(UUID actor, UUID school) {
        requireOwner(actor, school);
        return jdbc.queryForObject("""
            SELECT
            (SELECT COUNT(*) FROM math_portal.school_memberships WHERE school_id = ? AND role = 'PROFESOR') AS professors,
            (SELECT COUNT(*) FROM math_portal.school_memberships WHERE school_id = ? AND role = 'ALUMNO') AS students,
            (SELECT COUNT(*) FROM math_portal.courses WHERE school_id = ?) AS courses,
            (SELECT COUNT(*) FROM math_portal.topics WHERE school_id = ?) AS topics
            """, (rs, row) -> new Statistics(rs.getInt("professors"), rs.getInt("students"), rs.getInt("courses"), rs.getInt("topics")), school, school, school, school);
    }

    private void requireOwner(UUID actor, UUID school) {
        verifiedEmail(actor);
        // Serialize administration with ownership changes in the same school.
        if (jdbc.query("SELECT school_id FROM math_portal.school_directors WHERE school_id = ? AND user_id = ? FOR UPDATE",
            (rs, row) -> rs.getObject(1, UUID.class), school, actor).isEmpty()) throw notFound();
    }

    private void requireCourse(UUID school, UUID course) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM math_portal.courses WHERE school_id = ? AND id = ?)", Boolean.class, school, course))) throw notFound();
    }

    private String verifiedEmail(UUID actor) {
        return jdbc.query("SELECT email FROM auth.users WHERE id = ? AND email IS NOT NULL AND email_confirmed_at IS NOT NULL",
            (rs, row) -> rs.getString("email"), actor).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Confirma tu correo antes de continuar"));
    }

    private List<DirectorProfile> profileRows(UUID actor, String email) {
        return jdbc.query("SELECT name FROM math_portal.director_accounts WHERE user_id = ?",
            (rs, row) -> new DirectorProfile(actor, rs.getString("name"), email), actor);
    }

    private List<Member> memberRows(UUID school, UUID user) {
        String sql = "SELECT m.user_id, u.email, m.role FROM math_portal.school_memberships m LEFT JOIN auth.users u ON u.id = m.user_id WHERE m.school_id = ?";
        if (user != null) sql += " AND m.user_id = ?";
        sql += " ORDER BY u.email, m.user_id";
        return jdbc.query(sql, (rs, row) -> new Member(rs.getObject("user_id", UUID.class), rs.getString("email"), SchoolRole.valueOf(rs.getString("role"))),
            user == null ? new Object[] {school} : new Object[] {school, user});
    }

    private static ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Recurso no disponible"); }
    private static ResponseStatusException badRequest(String detail) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, detail); }
}
