package com.hackathon.mathportal.modules.auth.client;

import java.util.UUID;

/**
 * Operaciones de la Admin API de Supabase Auth. Requiere la clave service_role,
 * que solo existe en el backend; las pruebas usan una implementación falsa.
 */
public interface SupabaseAdminClient {
    /** Crea un usuario con correo confirmado y devuelve su id, que será el `sub` de sus JWT. */
    UUID createStudentUser(String email, String password, String username, String alias);

    /** Borra el usuario; un usuario inexistente se considera ya borrado. */
    void deleteUser(UUID userId);

    void updatePassword(UUID userId, String password);
}
