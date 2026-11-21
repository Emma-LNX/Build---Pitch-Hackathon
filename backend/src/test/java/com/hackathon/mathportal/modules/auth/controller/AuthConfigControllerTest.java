package com.hackathon.mathportal.modules.auth.controller;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class AuthConfigControllerTest {
    @Test
    void exposesOnlyPublicConfiguration() {
        var config = new AuthConfigController("https://example.supabase.co/auth/v1", "sb_publishable_example").config();
        assertThat(config.url()).isEqualTo("https://example.supabase.co");
        assertThat(config.publishableKey()).isEqualTo("sb_publishable_example");
    }

    @Test
    void rejectsSecretKeysAndLegacyServiceRoleKeys() {
        for (String key : new String[] { "", "sb_secret_private", jwt("service_role") }) {
            assertThatThrownBy(() -> new AuthConfigController("https://example.supabase.co/auth/v1", key).config())
                .isInstanceOf(ResponseStatusException.class);
        }
        assertThat(AuthConfigController.isPublicKey(jwt("anon"))).isTrue();
    }

    private String jwt(String role) {
        return "header." + Base64.getUrlEncoder().withoutPadding().encodeToString(
            ("{\"role\":\"" + role + "\"}").getBytes(StandardCharsets.UTF_8)) + ".signature";
    }
}
