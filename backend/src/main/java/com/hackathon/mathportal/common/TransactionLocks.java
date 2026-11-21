package com.hackathon.mathportal.common;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class TransactionLocks {
    private final JdbcTemplate jdbc;

    public TransactionLocks(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // PostgreSQL locks work across threads, backend replicas and different account owners.
    public void acquire(String key) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("El bloqueo requiere una transacción activa");
        }
        jdbc.queryForObject("select 1 from pg_advisory_xact_lock(hashtextextended(?, 0))", Integer.class, key);
    }
}
