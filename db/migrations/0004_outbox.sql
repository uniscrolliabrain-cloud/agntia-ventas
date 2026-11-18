-- 0004_outbox.sql
-- Outbox durable del puente hacia el agente padre (C36/C38).
-- Un evento emitido no es una entrega y una entrega no es un ACK: la tabla
-- guarda el intento, su resultado y el ACK del padre. La clave de operación
-- hace que repetir una petición no duplique el evento, y un ACK solo puede
-- cerrar una entrada que salió de `pending`.

create table if not exists app.parent_outbox (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  operation_key text not null,
  event_type text not null,
  payload_hash text not null check (payload_hash ~ '^sha256:[a-f0-9]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'acked', 'failed', 'unknown')),
  attempts integer not null default 0 check (attempts >= 0),
  ack_ref text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, operation_key),
  check (status <> 'acked' or ack_ref is not null)
);

create index if not exists parent_outbox_status_idx
  on app.parent_outbox (tenant_id, status);

alter table app.parent_outbox enable row level security;
alter table app.parent_outbox force row level security;

drop policy if exists parent_outbox_scope on app.parent_outbox;
create policy parent_outbox_scope on app.parent_outbox
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());
