package com.hackathon.mathportal.modules.auth.service;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class CurrentIdentity {
    public String subject() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)
                || jwt.getSubject() == null || jwt.getSubject().isBlank() || jwt.getSubject().length() > 255) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identidad no válida");
        }
        return jwt.getSubject();
    }
}
