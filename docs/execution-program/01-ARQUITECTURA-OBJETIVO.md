# Arquitectura objetivo de Ventas

Servicio TS/Hono/pnpm, API nominada, contratos Zod, Postgres/Supabase RLS, core determinista CRM/pipeline/CPQ/quotes, trabajadores con outbox e idempotencia, SDK, portal responsive y Anam como presencia. CRM Twenty opcional con discovery real; Frappe/Espo/Suite alternativas, no instalar todos. Firma/cobros son puertos separados y no autorizados por defecto.

`Supabase JWT+membership -> Hono -> Policy/AuthorityMap -> domain FSM/Decimal CPQ -> Postgres RLS+audit+outbox -> scoped workers -> typed adapters -> receipts/reconciliation -> parent bridge`.

Actor operador y tenant cliente distintos; twin vinculado al agente canónico del padre. Precios, descuentos, stock, plazos y firmas tienen fuentes y mandatos diferentes. No confundir forecast con ingresos cobrados. Dos tenants sintéticos para aceptación.
