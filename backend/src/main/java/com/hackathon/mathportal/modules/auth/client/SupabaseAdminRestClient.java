package com.hackathon.mathportal.modules.auth.client;

import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Component
public class SupabaseAdminRestClient implements SupabaseAdminClient {
    private static final Logger LOG = LoggerFactory.getLogger(SupabaseAdminRestClient.class);
    private final RestClient http;
    private final boolean configured;

    public SupabaseAdminRestClient(@Value("${supabase.url:http://localhost:54321}") String url,
            @Value("${supabase.service-role-key:}") String serviceRoleKey) {
        configured = serviceRoleKey != null && !serviceRoleKey.isBlank();
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(15));
        var builder = RestClient.builder().baseUrl(url.replaceAll("/+$", "") + "/auth/v1/admin").requestFactory(factory);
        if (configured) {
            builder.defaultHeader("apikey", serviceRoleKey.strip())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + serviceRoleKey.strip());
        }
        http = builder.build();
    }

    @Override
    public UUID createStudentUser(String email, String password, String username, String alias) {
        requireConfigured();
        var body = Map.of(
            "email", email,
            "password", password,
            "email_confirm", true,
            "user_metadata", Map.of("username", username, "alias", alias),
            "app_metadata", Map.of("kind", "student"));
        try {
            JsonNode user = http.post().uri("/users").contentType(MediaType.APPLICATION_JSON).body(body)
                .retrieve().body(JsonNode.class);
            // GoTrue devuelve el usuario directamente; algunas versiones lo envuelven en "user".
            JsonNode id = user == null ? null : user.hasNonNull("id") ? user.get("id") : user.path("user").get("id");
            if (id == null || !id.isTextual()) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "El servicio de cuentas no devolvió el usuario creado");
            return UUID.fromString(id.asText());
        } catch (RestClientResponseException ex) {
            throw translate(ex, "crear la cuenta");
        } catch (ResourceAccessException ex) {
            throw unreachable(ex);
        }
    }

    @Override
    public void deleteUser(UUID userId) {
        requireConfigured();
        try {
            http.delete().uri("/users/{id}", userId).retrieve().toBodilessEntity();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) return;
            throw translate(ex, "borrar la cuenta");
        } catch (ResourceAccessException ex) {
            throw unreachable(ex);
        }
    }

    @Override
    public void updatePassword(UUID userId, String password) {
        requireConfigured();
        try {
            http.put().uri("/users/{id}", userId).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("password", password)).retrieve().toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw translate(ex, "cambiar la contraseña");
        } catch (ResourceAccessException ex) {
            throw unreachable(ex);
        }
    }

    private void requireConfigured() {
        if (!configured) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "La creación de cuentas no está configurada: falta SUPABASE_SERVICE_ROLE_KEY en el backend");
        }
    }

    private static ResponseStatusException translate(RestClientResponseException ex, String action) {
        int status = ex.getStatusCode().value();
        String body = ex.getResponseBodyAsString().toLowerCase(Locale.ROOT);
        boolean rejected = status == 400 || status == 409 || status == 422;
        if (rejected && (body.contains("email_exists") || body.contains("user_already_exists")
                || body.contains("already been registered") || body.contains("already registered"))) {
            return new ResponseStatusException(HttpStatus.CONFLICT, "Ese usuario ya existe");
        }
        if (rejected && body.contains("weak_password")) {
            return new ResponseStatusException(HttpStatus.BAD_REQUEST, "La contraseña es muy débil; usa una más larga");
        }
        if (status == 404 || body.contains("user_not_found")) {
            return new ResponseStatusException(HttpStatus.NOT_FOUND, "Recurso no disponible");
        }
        LOG.warn("Supabase Admin API respondió {} al intentar {}", status, action);
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "El servicio de cuentas no pudo " + action);
    }

    private static ResponseStatusException unreachable(ResourceAccessException ex) {
        LOG.warn("No se pudo contactar la Admin API de Supabase", ex);
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "No se pudo contactar al servicio de cuentas");
    }
}
