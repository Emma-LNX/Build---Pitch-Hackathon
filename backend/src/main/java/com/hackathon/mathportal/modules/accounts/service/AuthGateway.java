package com.hackathon.mathportal.modules.accounts.service;

import java.util.UUID;

/**
 * Operaciones sobre el proveedor de identidad (Supabase Auth).
 * Las contraseñas solo pasan por aquí hacia el proveedor; nunca se guardan en la base de la API.
 */
public interface AuthGateway {
    record Tokens(String accessToken, String refreshToken, long expiresIn, UUID userId) {}

    /** Inicio de sesión con correo y contraseña. Lanza {@link InvalidCredentialsException} si no coinciden. */
    Tokens signIn(String email, String password);

    Tokens refresh(String refreshToken);

    void signOut(String accessToken);

    /** Crea un usuario ya confirmado (sin enviar correos) y devuelve su id. */
    UUID createUser(String email, String password, String displayName);

    void updatePassword(UUID userId, String password);

    void deleteUser(UUID userId);

    class InvalidCredentialsException extends RuntimeException {
        public InvalidCredentialsException() { super("Credenciales inválidas"); }
    }

    /** El proveedor rechazó crear el usuario porque el correo ya existe. */
    class DuplicateUserException extends RuntimeException {
        public DuplicateUserException() { super("El usuario ya existe en el proveedor"); }
    }

    /** Falta configuración o el proveedor no respondió. */
    class AuthUnavailableException extends RuntimeException {
        public AuthUnavailableException(String message, Throwable cause) { super(message, cause); }
    }
}
