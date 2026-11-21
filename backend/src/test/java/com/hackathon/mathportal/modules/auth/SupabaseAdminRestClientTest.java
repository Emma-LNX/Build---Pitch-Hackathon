package com.hackathon.mathportal.modules.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import com.hackathon.mathportal.modules.auth.client.SupabaseAdminRestClient;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

/** Prueba el cliente real contra un servidor HTTP local que imita la Admin API; nunca contacta Supabase. */
class SupabaseAdminRestClientTest {
    private HttpServer server;
    private volatile int status;
    private volatile String response;
    private volatile String method, path, apiKey, authorization, requestBody;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/auth/v1/admin/users", exchange -> {
            method = exchange.getRequestMethod();
            path = exchange.getRequestURI().getPath();
            apiKey = exchange.getRequestHeaders().getFirst("apikey");
            authorization = exchange.getRequestHeaders().getFirst("Authorization");
            requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            byte[] body = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, body.length == 0 ? -1 : body.length);
            try (var output = exchange.getResponseBody()) { output.write(body); }
        });
        server.start();
    }

    @AfterEach
    void stop() { server.stop(0); }

    @Test
    void createsConfirmedStudentWithServiceRoleHeaders() {
        UUID id = UUID.randomUUID();
        reply(200, "{\"id\":\"" + id + "\",\"email\":\"ana@alumnos.mayamente.app\"}");
        assertThat(client("clave-de-prueba").createStudentUser("ana@alumnos.mayamente.app", "secreto1", "ana", "Ana")).isEqualTo(id);
        assertThat(method).isEqualTo("POST");
        assertThat(apiKey).isEqualTo("clave-de-prueba");
        assertThat(authorization).isEqualTo("Bearer clave-de-prueba");
        assertThat(requestBody).contains("\"email\":\"ana@alumnos.mayamente.app\"", "\"email_confirm\":true",
            "\"kind\":\"student\"", "\"username\":\"ana\"", "\"alias\":\"Ana\"");
    }

    @Test
    void existingEmailBecomesConflict() {
        reply(422, "{\"code\":422,\"error_code\":\"email_exists\",\"msg\":\"A user with this email address has already been registered\"}");
        assertThatThrownBy(() -> client("clave").createStudentUser("ana@alumnos.mayamente.app", "secreto1", "ana", "Ana"))
            .isInstanceOfSatisfying(ResponseStatusException.class, ex -> assertThat(ex.getStatusCode().value()).isEqualTo(409));
    }

    @Test
    void unexpectedErrorBecomesBadGateway() {
        reply(500, "{\"msg\":\"boom\"}");
        assertThatThrownBy(() -> client("clave").createStudentUser("ana@alumnos.mayamente.app", "secreto1", "ana", "Ana"))
            .isInstanceOfSatisfying(ResponseStatusException.class, ex -> assertThat(ex.getStatusCode().value()).isEqualTo(502));
    }

    @Test
    void deleteAndPasswordUseUserPathAndMissingUserIsAlreadyDeleted() {
        UUID id = UUID.randomUUID();
        reply(200, "{}");
        client("clave").updatePassword(id, "nueva123");
        assertThat(method).isEqualTo("PUT");
        assertThat(path).isEqualTo("/auth/v1/admin/users/" + id);
        assertThat(requestBody).isEqualTo("{\"password\":\"nueva123\"}");
        reply(404, "{\"error_code\":\"user_not_found\"}");
        client("clave").deleteUser(id);
        assertThat(method).isEqualTo("DELETE");
    }

    @Test
    void missingServiceRoleKeyIsServiceUnavailableWithoutCallingSupabase() {
        reply(200, "{}");
        assertThatThrownBy(() -> client(" ").createStudentUser("ana@alumnos.mayamente.app", "secreto1", "ana", "Ana"))
            .isInstanceOfSatisfying(ResponseStatusException.class, ex -> assertThat(ex.getStatusCode().value()).isEqualTo(503));
        assertThat(method).isNull();
    }

    private void reply(int status, String response) {
        this.status = status;
        this.response = response;
    }

    private SupabaseAdminRestClient client(String key) {
        return new SupabaseAdminRestClient("http://127.0.0.1:" + server.getAddress().getPort() + "/", key);
    }
}
