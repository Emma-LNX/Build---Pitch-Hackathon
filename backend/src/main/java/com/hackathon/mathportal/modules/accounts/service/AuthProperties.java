package com.hackathon.mathportal.modules.accounts.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración del acceso con cuentas creadas por el profesor.
 *
 * @param supabaseUrl        URL base del proyecto Supabase, sin barra final.
 * @param anonKey            clave pública "anon": inicio de sesión y renovación.
 * @param serviceRoleKey     clave de servicio: SOLO en el servidor; crea usuarios y cambia contraseñas.
 * @param studentEmailDomain dominio del correo interno que identifica a cada estudiante en Supabase Auth.
 *                           El estudiante nunca lo ve ni lo escribe.
 */
@ConfigurationProperties(prefix = "mayamente.auth")
public record AuthProperties(String supabaseUrl, String anonKey, String serviceRoleKey, String studentEmailDomain) {
    public AuthProperties {
        if (studentEmailDomain == null || studentEmailDomain.isBlank()) studentEmailDomain = "alumnos.mayamente.invalid";
    }

    public boolean configured() {
        return notBlank(supabaseUrl) && notBlank(anonKey) && notBlank(serviceRoleKey);
    }

    private static boolean notBlank(String value) { return value != null && !value.isBlank(); }
}
