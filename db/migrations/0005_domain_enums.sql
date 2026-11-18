-- 0005_domain_enums.sql
-- Alinea los checks de estado de la base con la máquina de estados del dominio.
-- Antes, persistir una oportunidad en `in_review` o un handoff `returned`
-- fallaba aunque `packages/sales/src/models.ts` los permite, y una supresión
-- `manual` no podía guardarse. Los valores heredados se normalizan antes de
-- estrechar los checks.

update app.opportunities set stage = 'qualified' where stage = 'qualifying';
update app.opportunities set stage = 'proposal_draft' where stage = 'proposal';
update app.opportunities set stage = 'won_unverified' where stage = 'won';

alter table app.opportunities drop constraint if exists opportunities_stage_check;
alter table app.opportunities add constraint opportunities_stage_check check (
  stage in (
    'discovered', 'accepted', 'qualified', 'proposal_draft', 'in_review',
    'approved_to_send', 'sent', 'negotiating', 'won_unverified', 'won_verified',
    'lost', 'opted_out', 'reconciliation_required'
  )
);

-- `cancelled` se conserva como estado administrativo heredado; el dominio
-- emite `returned`.
alter table app.handoffs drop constraint if exists handoffs_status_check;
alter table app.handoffs add constraint handoffs_status_check check (
  status in (
    'proposed', 'offered', 'acknowledged', 'working', 'completed',
    'returned', 'cancelled'
  )
);

alter table app.suppressions drop constraint if exists suppressions_reason_check;
alter table app.suppressions add constraint suppressions_reason_check check (
  reason in ('opt_out', 'bounce', 'manual', 'complaint', 'privacy_request')
);
