-- Roles del arnés local (PGlite) y de un Postgres de laboratorio.
-- En Supabase estos roles ya existen y se gestionan por proyecto; este archivo
-- no forma parte de las migraciones de despliegue.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin nosuperuser nobypassrls nocreatedb nocreaterole;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_worker') then
    create role app_worker nologin nosuperuser nobypassrls nocreatedb nocreaterole;
  end if;
end
$$;
