-- Grants del arnés local. La API no es superusuario y no tiene BYPASSRLS:
-- cada acceso sigue sujeto a las políticas de la migración 0001.
grant usage on schema app to app_user, app_worker;

grant select on app.tenants to app_user, app_worker;
grant select, insert, update on app.memberships to app_user;
grant select on app.memberships to app_worker;
grant select, insert, update on app.work_orders to app_user, app_worker;
grant select, insert, update on app.twin_bindings to app_user;
grant select on app.twin_bindings to app_worker;
grant select, insert, update on app.delegation_mandates to app_user;
grant select on app.delegation_mandates to app_worker;

-- Dominio comercial (0002). El worker solo escribe resultados, no aprueba.
grant select, insert, update on app.accounts to app_user, app_worker;
grant select, insert, update on app.contacts to app_user, app_worker;
grant select, insert on app.contact_channels to app_user, app_worker;
grant select, insert, update on app.candidates to app_user, app_worker;
grant select, insert on app.suppressions to app_user, app_worker;
grant select, insert, update on app.opportunities to app_user, app_worker;
grant select, insert, update on app.activities to app_user, app_worker;
grant select, insert on app.quotes to app_user, app_worker;
grant select, insert, update on app.budget_reservations to app_user;
grant select, insert, update on app.approvals to app_user;
grant select on app.approvals to app_worker;
grant select, insert, update on app.handoffs to app_user, app_worker;
grant select, insert, update on app.parent_outbox to app_user;

-- El rol de API no puede crear ni alterar objetos del esquema.
revoke create on schema app from app_user, app_worker;
