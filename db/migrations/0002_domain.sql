-- 0002_domain.sql
-- Tablas de dominio comercial (campañas VTA-C07..C42).
-- Toda fila lleva tenant_id y toda referencia es compuesta (tenant_id, id):
-- una fila del tenant A no puede apuntar a una fila del tenant B.
-- Idempotente. RLS habilitada y forzada, igual que en 0001.

create table if not exists app.accounts (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  display_name text not null,
  domain text,
  source_ref text not null,
  source_hash text not null check (source_hash like 'sha256:%'),
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table if not exists app.contacts (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  account_id text not null,
  full_name text not null,
  role text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, account_id) references app.accounts (tenant_id, id)
    on delete cascade
);

create table if not exists app.contact_channels (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  contact_id text not null,
  channel text not null check (channel in ('email', 'phone', 'whatsapp', 'linkedin')),
  value text not null,
  verified boolean not null default false,
  unique (tenant_id, id),
  unique (tenant_id, channel, value),
  foreign key (tenant_id, contact_id) references app.contacts (tenant_id, id)
    on delete cascade
);

-- Permiso de contacto por canal: sin fila, no hay outreach.
create table if not exists app.candidates (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  contact_id text not null,
  source_credit text not null,
  discovered_at timestamptz not null,
  permission_basis text check (permission_basis in ('consent', 'legitimate_interest', 'contract')),
  permission_purpose text,
  permission_channel text,
  permission_expires_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, contact_id) references app.contacts (tenant_id, id),
  check (
    (permission_basis is null and permission_purpose is null
      and permission_channel is null and permission_expires_at is null)
    or (permission_basis is not null and permission_purpose is not null
      and permission_channel is not null and permission_expires_at is not null)
  )
);

create table if not exists app.suppressions (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  channel text not null,
  value text not null,
  reason text not null check (reason in ('opt_out', 'bounce', 'complaint', 'privacy_request')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, channel, value)
);

create table if not exists app.opportunities (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  account_id text not null,
  stage text not null check (
    stage in ('discovered', 'accepted', 'qualifying', 'qualified', 'proposal', 'won', 'lost')
  ),
  amount numeric(20, 8) check (amount is null or amount >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  version integer not null default 1 check (version > 0),
  evidence_refs text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, account_id) references app.accounts (tenant_id, id),
  check ((amount is null) = (currency is null))
);

create table if not exists app.activities (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  opportunity_id text not null,
  kind text not null check (kind in ('call', 'email', 'meeting', 'note', 'task')),
  occurred_at timestamptz not null,
  receipt_ref text,
  status text not null check (status in ('confirmed', 'outcome_unknown')),
  unique (tenant_id, id),
  foreign key (tenant_id, opportunity_id) references app.opportunities (tenant_id, id),
  check (status <> 'confirmed' or receipt_ref is not null)
);

create table if not exists app.quotes (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  opportunity_id text not null,
  price_book_version text not null,
  subtotal numeric(20, 8) not null check (subtotal >= 0),
  discount numeric(20, 8) not null check (discount >= 0),
  tax numeric(20, 8) not null check (tax >= 0),
  total numeric(20, 8) not null check (total >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  content_hash text not null check (content_hash like 'sha256:%'),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, opportunity_id) references app.opportunities (tenant_id, id)
);

create table if not exists app.approvals (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  resource_ref text not null,
  resource_version integer not null check (resource_version > 0),
  payload_hash text not null,
  rights_hash text not null,
  policy_hash text not null,
  reviewer_id text not null,
  proof_ref text not null check (length(proof_ref) > 0),
  recipient text not null,
  channel text not null,
  cost_ceiling numeric(20, 8) not null check (cost_ceiling >= 0),
  cost_ceiling_currency text not null check (cost_ceiling_currency ~ '^[A-Z]{3}$'),
  expires_at timestamptz not null,
  revocation_version integer not null check (revocation_version >= 0),
  status text not null default 'active' check (status in ('active', 'revoked', 'consumed')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table if not exists app.handoffs (
  id text primary key,
  tenant_id text not null references app.tenants (id),
  opportunity_id text not null,
  receiver_ref text not null,
  ack_ref text,
  status text not null check (
    status in ('proposed', 'offered', 'acknowledged', 'working', 'completed', 'cancelled')
  ),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, opportunity_id) references app.opportunities (tenant_id, id),
  check (status not in ('working', 'completed') or ack_ref is not null)
);

create index if not exists accounts_tenant_idx on app.accounts (tenant_id);
create index if not exists contacts_account_idx on app.contacts (tenant_id, account_id);
create index if not exists opportunities_account_idx on app.opportunities (tenant_id, account_id);
create index if not exists opportunities_stage_idx on app.opportunities (tenant_id, stage);
create index if not exists activities_opportunity_idx on app.activities (tenant_id, opportunity_id);
create index if not exists quotes_opportunity_idx on app.quotes (tenant_id, opportunity_id);
create index if not exists handoffs_opportunity_idx on app.handoffs (tenant_id, opportunity_id);

alter table app.accounts enable row level security;
alter table app.contacts enable row level security;
alter table app.contact_channels enable row level security;
alter table app.candidates enable row level security;
alter table app.suppressions enable row level security;
alter table app.opportunities enable row level security;
alter table app.activities enable row level security;
alter table app.quotes enable row level security;
alter table app.approvals enable row level security;
alter table app.handoffs enable row level security;

alter table app.accounts force row level security;
alter table app.contacts force row level security;
alter table app.contact_channels force row level security;
alter table app.candidates force row level security;
alter table app.suppressions force row level security;
alter table app.opportunities force row level security;
alter table app.activities force row level security;
alter table app.quotes force row level security;
alter table app.approvals force row level security;
alter table app.handoffs force row level security;

drop policy if exists accounts_scope on app.accounts;
create policy accounts_scope on app.accounts
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists contacts_scope on app.contacts;
create policy contacts_scope on app.contacts
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists contact_channels_scope on app.contact_channels;
create policy contact_channels_scope on app.contact_channels
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists candidates_scope on app.candidates;
create policy candidates_scope on app.candidates
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists suppressions_scope on app.suppressions;
create policy suppressions_scope on app.suppressions
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists opportunities_scope on app.opportunities;
create policy opportunities_scope on app.opportunities
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists activities_scope on app.activities;
create policy activities_scope on app.activities
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists quotes_scope on app.quotes;
create policy quotes_scope on app.quotes
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists approvals_scope on app.approvals;
create policy approvals_scope on app.approvals
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop policy if exists handoffs_scope on app.handoffs;
create policy handoffs_scope on app.handoffs
  for all
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());
