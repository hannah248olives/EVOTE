-- EVT-104: tenant isolation with PostgreSQL Row-Level Security (Charter sections 10.8 and 18).
--
-- How it works
--   * The API connects as the non-owner role evote_app. Superusers and table owners bypass RLS, so
--     the API must never connect as them.
--   * Per transaction the API sets the tenant: select set_config('app.tenant_id', '<uuid>', true).
--   * Every policy compares the row's tenant with app_tenant_id(). With no tenant set the function
--     returns NULL, the comparison is never true, and no rows are visible (fail closed).
--   * FORCE ROW LEVEL SECURITY applies the policies to the table owner as well.
--
-- Every new table that has a tenant_id MUST get the same four statements (enable, force, policy,
-- grant). The test suite fails if one is missing.

-- Roles belong to the whole server, not to one database, so they may already exist (another
-- database on the same server, or a concurrent migration). A plain "if not exists" check is not
-- atomic, so a race surfaces as unique_violation; both outcomes mean the role is there.
DO $$
BEGIN
  BEGIN
    CREATE ROLE evote_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  EXCEPTION WHEN duplicate_object OR unique_violation THEN
    NULL;
  END;
  BEGIN
    CREATE ROLE evote_lookup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  EXCEPTION WHEN duplicate_object OR unique_violation THEN
    NULL;
  END;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO evote_app, evote_lookup;
--> statement-breakpoint
CREATE FUNCTION app_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_tenant_id() TO evote_app;
--> statement-breakpoint
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON tenants
  USING (id = app_tenant_id())
  WITH CHECK (id = app_tenant_id());
--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE users FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());
--> statement-breakpoint
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE positions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON positions
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());
--> statement-breakpoint
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE candidates FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON candidates
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, users, positions, candidates TO evote_app;
--> statement-breakpoint
-- Resolving a school from its subdomain happens BEFORE a tenant is known, so it cannot go through
-- the policy above. Instead of opening the tenants table, a narrow SECURITY DEFINER function runs
-- as evote_lookup, a role that can read only id, subdomain and is_active of active tenants.
GRANT SELECT (id, subdomain, is_active) ON tenants TO evote_lookup;
--> statement-breakpoint
CREATE POLICY tenant_lookup ON tenants FOR SELECT TO evote_lookup USING (is_active);
--> statement-breakpoint
CREATE FUNCTION resolve_tenant_by_subdomain(p_subdomain text) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$ SELECT id FROM public.tenants WHERE subdomain = p_subdomain AND is_active $$;
--> statement-breakpoint
ALTER FUNCTION resolve_tenant_by_subdomain(text) OWNER TO evote_lookup;
--> statement-breakpoint
REVOKE ALL ON FUNCTION resolve_tenant_by_subdomain(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION resolve_tenant_by_subdomain(text) TO evote_app;
