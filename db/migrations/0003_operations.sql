-- 0003_operations.sql
-- Efectos persistidos e idempotentes (cotizaciones, aprobaciones, presupuesto).
-- Añade la clave de operación que hace que repetir una petición no duplique el
-- efecto, y una tabla de reservas de presupuesto con RLS forzada.

alter table app.quotes add column if not exists operation_key text;
alter table app.approvals add column if not exists operation_key text;

create unique index if not exists quotes_operation_key_uniq
  on app.quotes (tenant_id, operation_key)
  where operation_key is not null;

create unique index if not exists approvals_operation_key_uniq
  on app.approvals (tenant_id, operation_key)
  where operation_key is not null;

create table if not exists app.budget_reservations (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  operation_key text not null,
  amount numeric(20, 8) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'reserved'
    check (status in ('reserved', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, operation_key)
);

create index if not exists budget_reservations_status_idx
  on app.budget_reservations (tenant_id, status);

alter table app.budget_reservations enable row level security;
alter table app.budget_reservations force row level security;

drop policy if exists budget_reservations_scope on app.budget_reservations;
create policy budget_reservations_scope on app.budget_reservations
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());
