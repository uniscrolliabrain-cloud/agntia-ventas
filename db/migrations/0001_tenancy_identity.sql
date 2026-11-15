-- 0001_tenancy_identity.sql
-- Base de tenancy, identidad y delegación (campañas VTA-C02..C06).
-- Idempotente: se puede reaplicar sin efectos. Sin extensiones ni roles de
-- clúster: los roles y grants son específicos de cada despliegue y viven en
-- db/local/*.sql para el arnés, o en Supabase para producción.

create schema if not exists app;

create table if not exists app.schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);

-- Tenant es la empresa cliente del SaaS. No es un usuario ni una membership.
create table if not exists app.tenants (
  id text primary key,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

-- Membership provisionada en servidor: única fuente de rol y scopes.
create table if not exists app.memberships (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  user_id text not null,
  role text not null check (role in ('owner', 'admin', 'member', 'reviewer', 'viewer')),
  status text not null check (status in ('active', 'suspended', 'revoked')),
  scopes text[] not null default '{}',
  resource_scopes text[],
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, user_id)
);

-- Work order: encargo explícito que habilita delegación entre tenants.
create table if not exists app.work_orders (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  originating_tenant_id text not null references app.tenants (id),
  purpose text not null,
  accepted_by text,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'active', 'closed')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (originating_tenant_id <> tenant_id or accepted_by is not null)
);

-- Twin especializado: referencia canónica del padre + instancia local.
create table if not exists app.twin_bindings (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  canonical_agent_ref text not null,
  canonical_revision text not null,
  instance_ref text not null,
  work_order_id text not null,
  capabilities text[] not null,
  purpose text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revocation_version integer not null default 0 check (revocation_version >= 0),
  proof_ref text not null,
  unique (tenant_id, id),
  foreign key (tenant_id, work_order_id) references app.work_orders (tenant_id, id),
  check (expires_at > issued_at)
);

-- Mandato: actor/tenant de origen separados del tenant objetivo (data scope).
create table if not exists app.delegation_mandates (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  originating_tenant_id text not null references app.tenants (id),
  originating_actor_id text not null,
  twin_binding_id text not null,
  work_order_id text,
  capabilities text[] not null,
  purpose text not null,
  budget_amount numeric(20, 8) not null check (budget_amount > 0),
  budget_currency text not null check (budget_currency ~ '^[A-Z]{3}$'),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revocation_version integer not null default 0 check (revocation_version >= 0),
  proof_ref text not null,
  unique (tenant_id, id),
  foreign key (tenant_id, twin_binding_id) references app.twin_bindings (tenant_id, id),
  foreign key (tenant_id, work_order_id) references app.work_orders (tenant_id, id),
  check (expires_at > issued_at),
  -- Delegación cross-tenant exige work order explícita.
  check (originating_tenant_id = tenant_id or work_order_id is not null)
);

create index if not exists memberships_user_idx on app.memberships (user_id);
create index if not exists twin_bindings_tenant_idx on app.twin_bindings (tenant_id);
create index if not exists mandates_tenant_idx on app.delegation_mandates (tenant_id);

-- Tenant actual, fijado por el servidor en cada transacción a partir del
-- principal verificado. Nunca proviene del body, del modelo ni de user_metadata.
create or replace function app.current_tenant_id() returns text
language sql stable as $$
  select nullif(current_setting('app.tenant_id', true), '')
$$;

create or replace function app.current_actor_id() returns text
language sql stable as $$
  select nullif(current_setting('app.actor_id', true), '')
$$;

alter table app.tenants enable row level security;
alter table app.memberships enable row level security;
alter table app.work_orders enable row level security;
alter table app.twin_bindings enable row level security;
alter table app.delegation_mandates enable row level security;

-- FORCE extiende RLS al dueño de la tabla; un superusuario o BYPASSRLS sigue
-- exento, por eso la credencial de la API nunca es superusuario.
alter table app.tenants force row level security;
alter table app.memberships force row level security;
alter table app.work_orders force row level security;
alter table app.twin_bindings force row level security;
alter table app.delegation_mandates force row level security;

drop policy if exists tenants_scope on app.tenants;
create policy tenants_scope on app.tenants
  for select using (id = app.current_tenant_id());

drop policy if exists memberships_scope on app.memberships;
create policy memberships_scope on app.memberships
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists work_orders_scope on app.work_orders;
create policy work_orders_scope on app.work_orders
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists twin_bindings_scope on app.twin_bindings;
create policy twin_bindings_scope on app.twin_bindings
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists mandates_scope on app.delegation_mandates;
create policy mandates_scope on app.delegation_mandates
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());
