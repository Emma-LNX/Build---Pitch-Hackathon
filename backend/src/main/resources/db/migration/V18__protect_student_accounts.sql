-- Igual que V4/V6: tabla privada de la API, sin acceso directo desde el navegador.
REVOKE ALL ON ALL TABLES IN SCHEMA math_portal FROM PUBLIC;
ALTER TABLE math_portal.student_accounts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE client_role text;
BEGIN
 FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA math_portal FROM %I', client_role);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA math_portal FROM %I', client_role);
  END IF;
 END LOOP;
END;
$$;
