package com.hackathon.mathportal;

import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.env.PropertiesPropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;
import static org.assertj.core.api.Assertions.assertThat;

class SupabaseEnvironmentTest {
    private MockEnvironment environment() {
        var yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        var environment = new MockEnvironment();
        environment.getPropertySources().addLast(new PropertiesPropertySource("application", Objects.requireNonNull(yaml.getObject())));
        return environment;
    }

    @Test
    void acceptsPublishableAndSecretNamesWithoutExposingTheSecretToPublicConfig() {
        var env = environment().withProperty("SUPABASE_URL", "https://project.supabase.co")
            .withProperty("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
            .withProperty("SUPABASE_SECRET_KEY", "sb_secret_test")
            .withProperty("SUPABASE_JWKS_URL", "https://project.supabase.co/auth/v1/.well-known/jwks.json");
        assertThat(env.getProperty("mayamente.auth.anon-key")).isEqualTo("sb_publishable_test");
        assertThat(env.getProperty("mayamente.auth.service-role-key")).isEqualTo("sb_secret_test");
        assertThat(env.getProperty("supabase.service-role-key")).isEqualTo("sb_secret_test");
        assertThat(env.getProperty("spring.security.oauth2.resourceserver.jwt.jwk-set-uri"))
            .isEqualTo("https://project.supabase.co/auth/v1/.well-known/jwks.json");
    }

    @Test
    void retainsLegacyKeyNames() {
        var env = environment().withProperty("SUPABASE_ANON_KEY", "legacy-public")
            .withProperty("SUPABASE_SERVICE_ROLE_KEY", "legacy-server")
            .withProperty("SUPABASE_SECRET_KEY", "new-server");
        assertThat(env.getProperty("mayamente.auth.anon-key")).isEqualTo("legacy-public");
        assertThat(env.getProperty("mayamente.auth.service-role-key")).isEqualTo("legacy-server");
    }

    @Test
    void derivesIssuerAndJwksWhenOnlyTheProjectUrlIsProvided() {
        var env = environment().withProperty("SUPABASE_URL", "https://project.supabase.co");
        assertThat(env.getProperty("spring.security.oauth2.resourceserver.jwt.issuer-uri"))
            .isEqualTo("https://project.supabase.co/auth/v1");
        assertThat(env.getProperty("spring.security.oauth2.resourceserver.jwt.jwk-set-uri"))
            .isEqualTo("https://project.supabase.co/auth/v1/.well-known/jwks.json");
    }
}
