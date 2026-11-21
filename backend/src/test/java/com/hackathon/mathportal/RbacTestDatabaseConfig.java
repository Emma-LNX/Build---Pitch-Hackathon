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
            // H2 exercises school authorization; PostgreSQL migrations run in the student integration suite.
            try (var connection = dataSource.getConnection()) {
                try (var statement = connection.createStatement()) { statement.execute("CREATE SCHEMA IF NOT EXISTS math_portal"); }
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V3__school_rbac.sql"));
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V5__directors.sql"));
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V8__classrooms.sql"));
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
