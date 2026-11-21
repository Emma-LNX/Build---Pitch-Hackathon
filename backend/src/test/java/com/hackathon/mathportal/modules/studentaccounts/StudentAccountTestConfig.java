package com.hackathon.mathportal.modules.studentaccounts;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import javax.sql.DataSource;
import com.hackathon.mathportal.modules.auth.client.SupabaseAdminClient;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.web.server.ResponseStatusException;

@TestConfiguration
public class StudentAccountTestConfig {
    @Bean
    FlywayMigrationStrategy studentAccountMigrations(DataSource dataSource) {
        return flyway -> {
            try (var connection = dataSource.getConnection()) {
                try (var statement = connection.createStatement()) { statement.execute("CREATE SCHEMA IF NOT EXISTS math_portal"); }
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V3__school_rbac.sql"));
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V5__directors.sql"));
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V8__classrooms.sql"));
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("student-accounts-test-schema.sql"));
            } catch (java.sql.SQLException exception) {
                throw new IllegalStateException(exception);
            }
        };
    }

    @Bean @Primary
    FakeSupabaseAdminClient fakeSupabaseAdminClient(JdbcTemplate jdbc) { return new FakeSupabaseAdminClient(jdbc); }

    /** Imita Supabase Auth escribiendo en la tabla auth.users de H2; nunca hace llamadas de red. */
    public static class FakeSupabaseAdminClient implements SupabaseAdminClient {
        private final JdbcTemplate jdbc;
        final List<String> createdEmails = new CopyOnWriteArrayList<>();
        final List<UUID> deleted = new CopyOnWriteArrayList<>();
        final Map<UUID, String> passwords = new ConcurrentHashMap<>();
        volatile UUID nextId;

        FakeSupabaseAdminClient(JdbcTemplate jdbc) { this.jdbc = jdbc; }

        @Override
        public UUID createStudentUser(String email, String password, String username, String alias) {
            if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = ?)", Boolean.class, email))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ese usuario ya existe");
            }
            UUID id = nextId != null ? nextId : UUID.randomUUID();
            nextId = null;
            jdbc.update("INSERT INTO auth.users VALUES (?, ?, ?)", id, email, OffsetDateTime.now());
            createdEmails.add(email);
            passwords.put(id, password);
            return id;
        }

        @Override
        public void deleteUser(UUID userId) {
            deleted.add(userId);
            jdbc.update("DELETE FROM auth.users WHERE id = ?", userId);
        }

        @Override
        public void updatePassword(UUID userId, String password) { passwords.put(userId, password); }

        void reset() {
            createdEmails.clear();
            deleted.clear();
            passwords.clear();
            nextId = null;
        }
    }
}
