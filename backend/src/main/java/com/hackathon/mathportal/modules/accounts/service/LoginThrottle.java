package com.hackathon.mathportal.modules.accounts.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Freno simple contra adivinar contraseñas: tras varios fallos seguidos con el
 * mismo usuario, se bloquea temporalmente. Vive en memoria (una instancia);
 * Supabase Auth aplica además sus propios límites.
 */
@Component
public class LoginThrottle {
    static final int MAX_FAILURES = 5;
    static final Duration LOCK = Duration.ofMinutes(5);

    private record State(int failures, Instant lockedUntil) {}

    private final ConcurrentHashMap<String, State> states = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginThrottle(Clock clock) { this.clock = clock; }

    public boolean isLocked(String key) {
        State s = states.get(key);
        return s != null && s.lockedUntil() != null && clock.instant().isBefore(s.lockedUntil());
    }

    public void failure(String key) {
        states.compute(key, (k, s) -> {
            int failures = (s == null ? 0 : s.failures()) + 1;
            return failures >= MAX_FAILURES ? new State(0, clock.instant().plus(LOCK)) : new State(failures, null);
        });
    }

    public void success(String key) { states.remove(key); }
}
