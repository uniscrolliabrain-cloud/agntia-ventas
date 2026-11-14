# Contratos y puertos de Ventas

Leer `docs/contracts/01-contratos.md`, `docs/architecture/01-arquitectura.md`, `docs/architecture/02-identidad-twins.md`, `docs/architecture/03-compatibilidad-agente.md`, `docs/architecture/04-runtime.md`.

Supabase JWT verificado con membership server-side, ACL tenant/recurso/campo, actor y targetTenant separados; twin solo con mandato firmado/verificable y capability nominada. FSM deterministic y revisiones, pricing Decimal con currency/rounding y tax mapping verificado. AuthorityMap para CRM, catálogo, precio, contacto, aprobación, firma y handoff; un emisor por efecto. Efectos comerciales externos requieren aprobación y base legal; opt-out y suppressions fail-closed. Outbox/inbox, idempotencia, receipts, unknown outcomes reconciliados. SDK/bridge padre versionados, no inventar equivalencia de ADTC con SystemEvent nativo. Proveedores sin credenciales: mocks etiquetados, capability BLOCKED, nunca fingir integración real.
