package com.hackathon.mathportal.modules.accounts.service;

import java.util.Map;
import java.util.UUID;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/** Cliente HTTP de la API de Supabase Auth (GoTrue). */
@Component
public class SupabaseAuthGateway implements AuthGateway {
    private final AuthProperties props;
    private final RestClient http;

    public SupabaseAuthGateway(AuthProperties props, RestClient.Builder builder) {
        this.props = props;
        this.http = builder.build();
    }

    @Override
    public Tokens signIn(String email, String password) {
        try {
            return tokens(publicCall().post().uri(url("/token?grant_type=password"))
                .body(Map.of("email", email, "password", password)).retrieve().body(JsonNode.class));
        } catch (RestClientResponseException ex) {
            if (isClientError(ex.getStatusCode())) throw new InvalidCredentialsException();
            throw unavailable(ex);
        } catch (RestClientException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    public Tokens refresh(String refreshToken) {
        try {
            return tokens(publicCall().post().uri(url("/token?grant_type=refresh_token"))
                .body(Map.of("refresh_token", refreshToken)).retrieve().body(JsonNode.class));
        } catch (RestClientResponseException ex) {
            if (isClientError(ex.getStatusCode())) throw new InvalidCredentialsException();
            throw unavailable(ex);
        } catch (RestClientException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    public void signOut(String accessToken) {
        try {
            publicCall().post().uri(url("/logout")).header("Authorization", "Bearer " + accessToken)
                .retrieve().toBodilessEntity();
        } catch (RestClientResponseException ex) {
            // Un token ya vencido o revocado no impide cerrar la sesión en el teléfono.
            if (!isClientError(ex.getStatusCode())) throw unavailable(ex);
        } catch (RestClientException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    public UUID createUser(String email, String password, String displayName) {
        try {
            JsonNode user = adminCall().post().uri(url("/admin/users"))
                .body(Map.of(
                    "email", email,
                    "password", password,
                    "email_confirm", true,
                    // app_metadata solo la escribe el servidor; no concede permisos (se consultan en la base).
                    "app_metadata", Map.of("account_type", "student"),
                    "user_metadata", Map.of("display_name", displayName)))
                .retrieve().body(JsonNode.class);
            return UUID.fromString(user.path("id").asText());
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 422 || ex.getStatusCode().value() == 409) throw new DuplicateUserException();
            throw unavailable(ex);
        } catch (RestClientException | IllegalArgumentException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    public void updatePassword(UUID userId, String password) {
        try {
            adminCall().put().uri(url("/admin/users/" + userId)).body(Map.of("password", password))
                .retrieve().toBodilessEntity();
        } catch (RestClientException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    public void deleteUser(UUID userId) {
        try {
            adminCall().delete().uri(url("/admin/users/" + userId)).retrieve().toBodilessEntity();
        } catch (RestClientException ex) {
            throw unavailable(ex);
        }
    }

    private RestClient publicCall() {
        requireConfigured();
        return http.mutate().defaultHeader("apikey", props.anonKey())
            .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
    }

    private RestClient adminCall() {
        requireConfigured();
        return http.mutate().defaultHeader("apikey", props.serviceRoleKey())
            .defaultHeader("Authorization", "Bearer " + props.serviceRoleKey())
            .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
    }

    private void requireConfigured() {
        if (!props.configured()) {
            throw new AuthUnavailableException(
                "Falta configurar MAYAMENTE_SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en el backend", null);
        }
    }

    private String url(String path) {
        String base = props.supabaseUrl().endsWith("/") ? props.supabaseUrl().substring(0, props.supabaseUrl().length() - 1) : props.supabaseUrl();
        return base + "/auth/v1" + path;
    }

    private static Tokens tokens(JsonNode body) {
        if (body == null || !body.hasNonNull("access_token")) throw new InvalidCredentialsException();
        return new Tokens(body.path("access_token").asText(), body.path("refresh_token").asText(),
            body.path("expires_in").asLong(3600), UUID.fromString(body.path("user").path("id").asText()));
    }

    private static boolean isClientError(HttpStatusCode status) {
        return status.is4xxClientError() && status.value() != HttpStatus.TOO_MANY_REQUESTS.value();
    }

    private static AuthUnavailableException unavailable(Exception cause) {
        return new AuthUnavailableException("El servicio de cuentas no respondió", cause);
    }
}
