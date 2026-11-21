package com.hackathon.mathportal;

import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/**
 * H2 con las migraciones portables de colegios (V3, V5) y cuentas (V15).
 * V1 usa tipos propios de PostgreSQL, así que se crea una tabla alumnos equivalente.
 */
@TestConfiguration
public class AccountsTestDatabaseConfig {
    @Bean
    FlywayMigrationStrategy testMigrations(DataSource dataSource) {
        return flyway -> {
            try (var connection = dataSource.getConnection()) {
                try (var statement = connection.createStatement()) { statement.execute("CREATE SCHEMA IF NOT EXISTS math_portal"); }
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V3__school_rbac.sql"));
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V5__directors.sql"));
                try (var statement = connection.createStatement()) {
                    statement.execute("""
                        CREATE TABLE math_portal.alumnos (
                            id UUID PRIMARY KEY,
                            auth_subject VARCHAR(255) NOT NULL UNIQUE,
                            alias VARCHAR(40) NOT NULL,
                            avatar_clave VARCHAR(100),
                            grado_escolar VARCHAR(30),
                            zona_horaria VARCHAR(100) NOT NULL DEFAULT 'America/Guatemala',
                            participa_ranking BOOLEAN NOT NULL DEFAULT FALSE,
                            estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
                            creado_en TIMESTAMP WITH TIME ZONE NOT NULL,
                            actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL)
                        """);
                }
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V15__student_accounts.sql"));
                try (var statement = connection.createStatement()) {
                    statement.execute("CREATE SCHEMA IF NOT EXISTS auth");
                    statement.execute("CREATE TABLE auth.users (id UUID PRIMARY KEY, email VARCHAR(254), email_confirmed_at TIMESTAMP WITH TIME ZONE)");
                }
            } catch (java.sql.SQLException exception) {
                throw new IllegalStateException(exception);
            }
        };
    }
}
