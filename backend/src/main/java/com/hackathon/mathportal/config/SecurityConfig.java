package com.hackathon.mathportal.config;

import java.time.Clock;
import java.util.Objects;
import org.springframework.boot.autoconfigure.security.oauth2.resource.OAuth2ResourceServerProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;

@Configuration
public class SecurityConfig {
    @Bean
    Clock clock() { return Clock.systemUTC(); }

    @Bean
    JwtDecoder jwtDecoder(OAuth2ResourceServerProperties properties) {
        var config = properties.getJwt();
        var decoder = NimbusJwtDecoder.withJwkSetUri(config.getJwkSetUri())
            .jwsAlgorithm(SignatureAlgorithm.ES256).jwsAlgorithm(SignatureAlgorithm.RS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer(config.getIssuerUri()),
            new JwtClaimValidator<java.util.List<String>>("aud", audiences ->
                audiences != null && audiences.containsAll(config.getAudiences())),
            new JwtClaimValidator<String>("sub", subject ->
                isUuid(subject)),
            new JwtClaimValidator<java.time.Instant>("exp", Objects::nonNull)));
        return decoder;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                .requestMatchers("/schools", "/schools/**", "/directors/**", "/students/**",
                    "/activities/**", "/activity-versions/**", "/topics/**", "/attempts/**",
                    "/levels/**", "/ranking/**", "/estadisticas/**").authenticated()
                .anyRequest().denyAll())
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()))
            .build();
    }
    private static boolean isUuid(String value) {
        if (value == null) return false;
        try { return java.util.UUID.fromString(value).toString().equalsIgnoreCase(value); }
        catch (IllegalArgumentException ex) { return false; }
    }
}
