package com.hackathon.mathportal.modules.auth.service;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SchoolAdministrationAccess {
    private final JdbcTemplate jdbc;
    public SchoolAdministrationAccess(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public String verifiedEmail(UUID actor) {
        return jdbc.query("SELECT email FROM auth.users WHERE id = ? AND email IS NOT NULL AND email_confirmed_at IS NOT NULL",
            (rs, row) -> rs.getString("email"), actor).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Confirma tu correo antes de continuar"));
    }

    // Call inside the caller's transaction; serializes administration of the same school.
    public void requireDirector(UUID actor, UUID school) {
        verifiedEmail(actor);
        if (jdbc.query("SELECT school_id FROM math_portal.school_directors WHERE school_id = ? AND user_id = ? FOR UPDATE",
            (rs, row) -> rs.getObject(1, UUID.class), school, actor).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recurso no disponible");
        }
    }

    public boolean isDirector(UUID actor, UUID school) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM math_portal.school_directors WHERE school_id = ? AND user_id = ?)", Boolean.class, school, actor));
    }
}
