package com.hackathon.mathportal.modules.auth.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AuthConfigController {
    private final String issuer;
    private final String publicKey;

    public AuthConfigController(
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
            @Value("${SUPABASE_PUBLISHABLE_KEY:}") String publicKey) {
        this.issuer = issuer;
        this.publicKey = publicKey;
    }

    public record Config(String url, String publishableKey) {}

    @GetMapping("/auth/config")
    public Config config() {
        // Se publica únicamente una publishable key, nunca una clave administrativa.
        if (!isPublicKey(publicKey)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Configura SUPABASE_PUBLISHABLE_KEY en el backend");
        }
        return new Config(issuer.replaceFirst("/auth/v1/?$", ""), publicKey);
    }

    static boolean isPublicKey(String key) {
        if (key.startsWith("sb_publishable_")) return true;
        // Compatibilidad con anon keys antiguas; nunca publicar JWT service_role.
        try {
            var parts = key.split("\\.");
            if (parts.length != 3) return false;
            var payload = new com.fasterxml.jackson.databind.ObjectMapper().readTree(
                java.util.Base64.getUrlDecoder().decode(parts[1]));
            return "anon".equals(payload.path("role").asText());
        } catch (Exception error) { return false; }
    }
}
