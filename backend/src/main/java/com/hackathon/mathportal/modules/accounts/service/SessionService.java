package com.hackathon.mathportal.modules.accounts.service;

import java.util.Locale;
import com.hackathon.mathportal.modules.accounts.dto.AccountDtos;
import com.hackathon.mathportal.modules.accounts.dto.AccountDtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Inicio, renovación y cierre de sesión a través de Supabase Auth. No guarda contraseñas. */
@Service
public class SessionService {
    private final AuthGateway auth;
    private final StudentAccountService accounts;
    private final LoginThrottle throttle;

    public SessionService(AuthGateway auth, StudentAccountService accounts, LoginThrottle throttle) {
        this.auth = auth;
        this.accounts = accounts;
        this.throttle = throttle;
    }

    public Session studentLogin(StudentLogin request) {
        String normalized = StudentAccountService.normalize(request.username());
        String key = "student:" + normalized;
        if (throttle.isLocked(key)) throw tooManyAttempts();
        if (!normalized.matches(AccountDtos.USERNAME_PATTERN)) {
            throttle.failure(key);
            throw invalidCredentials();
        }
        try {
            AuthGateway.Tokens tokens;
            try {
                tokens = auth.signIn(accounts.studentEmail(normalized), request.password());
            } catch (AuthGateway.InvalidCredentialsException legacy) {
                // main también crea cuentas por aula con este dominio fijo.
                tokens = auth.signIn(normalized + "@alumnos.mayamente.app", request.password());
            }
            // Solo las cuentas creadas por un profesor entran por este formulario.
            if (!accounts.isStudentAccount(tokens.userId())) {
                auth.signOut(tokens.accessToken());
                throw new AuthGateway.InvalidCredentialsException();
            }
            throttle.success(key);
            return new Session(tokens.accessToken(), tokens.refreshToken(), tokens.expiresIn());
        } catch (AuthGateway.InvalidCredentialsException ex) {
            throttle.failure(key);
            throw invalidCredentials();
        }
    }

    public Session staffLogin(StaffLogin request) {
        String key = "staff:" + request.email().strip().toLowerCase(Locale.ROOT);
        if (throttle.isLocked(key)) throw tooManyAttempts();
        try {
            var tokens = auth.signIn(request.email().strip(), request.password());
            throttle.success(key);
            return new Session(tokens.accessToken(), tokens.refreshToken(), tokens.expiresIn());
        } catch (AuthGateway.InvalidCredentialsException ex) {
            throttle.failure(key);
            throw invalidCredentials();
        }
    }

    public Session refresh(RefreshRequest request) {
        try {
            var tokens = auth.refresh(request.refreshToken());
            return new Session(tokens.accessToken(), tokens.refreshToken(), tokens.expiresIn());
        } catch (AuthGateway.InvalidCredentialsException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La sesión venció. Vuelve a entrar.");
        }
    }

    public void logout(String accessToken) { auth.signOut(accessToken); }

    private static ResponseStatusException invalidCredentials() {
        // Mismo mensaje para usuario inexistente o contraseña incorrecta.
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
    }

    private static ResponseStatusException tooManyAttempts() {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos. Espera unos minutos.");
    }
}
