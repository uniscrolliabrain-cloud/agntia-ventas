# VTA-C06 — Persistencia, RLS y migraciones

**Estado: PASS con PostgreSQL real (PGlite/WASM); Supabase real `NOT_VERIFIED`.**

## Decisión de entorno

`docker` devuelve *permission denied* en este VM, así que no había servidor
Postgres por contenedor. En vez de saltarse la campaña o simular RLS con un mock,
se adoptó **PGlite** (PostgreSQL compilado a WASM) como arnés: mismo dialecto,
mismas políticas, mismo `SET ROLE`. El adaptador de producción (`pg`) envuelve un
`Pool` real; la API sólo usa el repositorio, no PGlite.

## Artefactos

- `db/migrations/0001_tenancy_identity.sql` — `app.tenants`, `app.memberships`,
  `app.work_orders`, `app.twin_bindings`, `app.delegation_mandates`,
  `app.schema_migrations`; RLS habilitada y **forzada** en las cinco tablas;
  funciones `app.current_tenant_id()` / `app.current_actor_id()` sobre ajustes
  de transacción; FKs compuestas por tenant; `numeric(20,8)` para presupuesto con
  `check > 0`; `check` de moneda ISO-4217; `check` de work order obligatoria para
  delegación cross-tenant; `check` de expiración posterior a emisión.
- `db/local/00-local-roles.sql` y `10-local-grants.sql` — roles
  `app_user`/`app_worker` (`nosuperuser`, `nobypassrls`) y grants mínimos. **No**
  forman parte de las migraciones: en Supabase los roles los gestiona el
  proyecto, y crear roles en una migración rompería el despliegue.
- `packages/persistence/src/migrate.ts` — runner idempotente con checksum
  SHA-256; una migración ya aplicada que cambió es un fallo duro, no un skip.
- `packages/persistence/src/tenant-session.ts` — una transacción por petición:
  `begin`, `set local role`, `set_config('app.tenant_id')`, commit/rollback;
  llamadas serializadas porque una conexión no admite transacciones cruzadas.
- `packages/persistence/src/membership-repository.ts` — puerto de identidad sobre
  sesión tenant-scoped, más factoría con `Pool` de `pg` (una conexión por
  búsqueda, liberada al final).
- `apps/api/src/server.ts` — si existe `DATABASE_URL` usa el repositorio real; si
  no, responde 424 en rutas autenticadas. Nunca hay principal por defecto.

## Pruebas ejecutadas — `pnpm run test`, exit 0

| Archivo | Casos | Resultado |
|---|---|---|
| `packages/persistence/src/migrate.test.ts` | 4 | PASS |
| `packages/persistence/src/rls.test.ts` | 8 | PASS |
| `packages/persistence/src/membership-repository.test.ts` | 4 | PASS |
| `apps/api/src/app.integration.test.ts` | 5 | PASS |

Verificado con ejecución real:

- migración aplicada una vez, reaplicada como *skipped*, checksum registrado
- migración alterada después de aplicar → error de checksum
- migración fallida → rollback y ninguna tabla parcial
- RLS habilitada **y forzada** en las 5 tablas (`relrowsecurity` y
  `relforcerowsecurity` = true)
- tenant A no ve filas de B en `memberships`, `twin_bindings`,
  `delegation_mandates` ni `tenants`; B no ve el mandato de A
- sin `app.tenant_id` verificado → 0 filas (fail-closed real, no mock)
- INSERT de membership con `tenant_id` ajeno bajo scope A → violación de política
- dentro de la transacción `current_user = app_user`, y `app_user`/`app_worker`
  tienen `rolsuper=false` y `rolbypassrls=false`
- tras el commit no queda `app.tenant_id` en la sesión y el rol vuelve al de
  migración
- `app_worker` puede leer pero no escribir
- mandato que referencia el twin de otro tenant → violación de FK compuesta
- delegación cross-tenant sin work order y presupuesto `0` → violación de `check`
- integración completa: JWT firmado → verificación → lookup de membership bajo
  RLS → principal con rol y scopes de la base de datos; dos tenants sintéticos
  aislados, membership suspendida bloqueada, token expirado/ajeno rechazado

## Bloqueos / no verificado

- **`NOT_VERIFIED` — Supabase real:** no hay proyecto ni credenciales; no se probó
  `auth.uid()`, el rol `authenticated` de Supabase, ni el pooler.
- **`NOT_VERIFIED` — adaptador `pg`:** compila, pero no se ejecutó contra un
  servidor Postgres real (sin Docker). El arnés prueba el mismo SQL vía PGlite.
- **`NOT_VERIFIED` — Storage, Realtime, búsqueda/vectores, cache, exports y
  backups:** no hay servicio que probar; siguen pendientes y deshabilitados.
- Migraciones de dominio (cuentas, oportunidades, catálogo, quotes, receipts):
  pertenecen a C09–C32 y se añadirán como migraciones aditivas.
- Sin pruebas de carga ni de concurrencia con pool real.

## Siguiente dependencia

C07 (mandatos, finalidad y aprobaciones) — el esquema ya soporta mandatos; falta
el flujo de `ApprovalBinding` y su invalidación por cambio material.
