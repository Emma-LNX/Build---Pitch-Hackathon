package com.hackathon.mathportal;

import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

@TestConfiguration
public class RbacTestDatabaseConfig {
    @Bean
    FlywayMigrationStrategy testMigrations(DataSource dataSource) {
        return flyway -> {
            flyway.migrate(); // V1: common relational schema; PostgreSQL-specific RLS is checked separately.
            try (var connection = dataSource.getConnection()) {
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V3__directors.sql"));
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V5__classrooms.sql"));
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("teacher-test-schema.sql"));
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
