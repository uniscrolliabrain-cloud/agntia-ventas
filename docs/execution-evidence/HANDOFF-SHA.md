# Handoff de ejecución — C01–C06 y bloque C07–C42

Rama aislada: `impl/factory-c01-c05` (no se ha escrito en `main`).
SHA base: `3e9ae1c8bc28b3a37741eb36a77c1235e523e7b8`.
SHA de implementación C01–C06: `73c9949` (`feat(persistence): C06 migrations with forced RLS…`).
SHA del bloque C07–C42: cabeza de la rama, commit
`feat(sales): implementar el bloque C07-C42 con stubs que fallan cerrado`
(`git log -1 --format=%H`); sus padres son `36c4905` y `73c9949`.
Historial de la rama: `9d04e72` (C01–C05) → `e57df78` (evidencia) → `73c9949` (C06)
→ `36c4905` (handoff) → commit C07–C42 (`packages/sales`, `0002_domain.sql`, informes).

## Reproducción

```bash
pnpm install            # exit 0, lockfile pnpm-lock.yaml
pnpm run typecheck      # exit 0 (contracts, domain, identity, sales, persistence, api)
pnpm run test           # exit 0, 289 tests / 30 archivos
```

Conteo por paquete: contracts 12, domain 14, identity 31, sales 149,
persistence 39, api 44. Reejecutado el 2026-11-18 (workspace restaurado:
`pnpm install --frozen-lockfile` exit 0 antes de las dos comprobaciones).

La primera ejecución de PGlite en un host frío tarda ~5 s en arrancar el
Postgres WASM; por eso `persistence` y `api` fijan `testTimeout: 30000` en su
`vitest.config.ts` (sin tocar aserciones).

## Smoke de servidor (ejecutado y detenido)

```bash
SUPABASE_JWT_ISSUER=... SUPABASE_JWKS_URL=... PORT=8787 pnpm run dev
curl /health                     # 200 {"status":"ok",...}
curl /v1/ventas/me               # 401 AUTH_MISSING + correlationId
curl -H 'Authorization: Bearer aaa.bbb.ccc' /v1/ventas/me   # 401 AUTH_INVALID
```

Con `DATABASE_URL` la API resuelve la membership contra Postgres con RLS; sin
ella responde 424 en rutas autenticadas. Nunca hay principal por defecto.

## Estado honesto

- Implementado y probado: C01 (baseline), C02 (autoridad, parcial), C03 (JWT y
  principal), C04 (twins/mandatos), C05 (DTOs, errores, dinero Decimal), C06
  (migraciones, RLS forzada, repositorio tenant-scoped, integración JWT→RLS→API).
- Bloque C07–C42: matriz completa en [C07-C42-REPORT.md](C07-C42-REPORT.md).
  25 campañas IMPLEMENTED con pruebas, 10 PARTIAL (CRM, suites CRM, firma,
  bridge, coste, fuentes, dashboard, SDK, CI y portal) y C42 documental. Los
  huecos de cada PARTIAL están declarados en `packages/sales/src/stubs.ts`
  (`CAPABILITY_STUBS`, 16 entradas) y en
  [REMAINING-STUBS.md](REMAINING-STUBS.md): un stub no es una capacidad
  instalada, falla cerrado con su código declarado.
  `db/migrations/0002_domain.sql` añade 10 tablas de dominio con FKs compuestas
  y RLS forzada; `0003_operations.sql` añade claves de operación y
  `budget_reservations`; `0004_outbox.sql` añade `parent_outbox` con RLS
  forzada y `packages/persistence/src/outbox-repository.ts` la máquina de
  estados durable (intento condicional, ACK con referencia, timeout y
  reconciliación). `0005_domain_enums.sql` alinea los checks de estado con el
  dominio. El transporte al padre sigue siendo STUB.
- Auditoría transversal del 2026-11-18: 49 defectos corregidos con prueba en
  tres pasadas (aislamiento por tenant, propósito de permiso, supresión por
  dirección, reloj del servidor, idempotencia de cotizaciones/aprobaciones,
  redirects y timeouts de proveedor, `no-store`, secretos, deriva
  dominio/esquema; y en la segunda: redondeo declarado en coste de modelo,
  dinero no negativo, atributos sensibles en cualquier grafía, ciclo en el
  hash, medianoche en el offset, cursor versionado de importación y paridad de
  la guarda SSRF de discovery; y en la tercera: caducidad y presupuesto del
  mandato con fecha/importe ilegible, `sub` del JWT validado como id opaco y
  `content-length` del origen comprobado antes de leer el cuerpo, y advisory
  lock en el runner de migraciones). Detalle y pendientes en
  [AUDIT-2026-11-18.md](AUDIT-2026-11-18.md).
- Superficie HTTP: cinco rutas preview y cinco rutas con efecto local idempotente
  (cotización y aprobación persistidas, revocación, lectura y portal firmado).
  Ninguna envía, firma, cobra ni llama a un proveedor.
- `.github/workflows/ci.yml` ejecuta install/typecheck/test, pero **no se ha
  ejecutado en este host**: no hay runner de GitHub aquí.
- `PARTIAL`: C01 y C02 (faltan `ServiceAgreement`/`WorkOrder` como DTO y el
  AuthorityMap persistido).
- Decisión de entorno: al no haber Docker utilizable, las pruebas de base de datos
  corren sobre **PGlite** (PostgreSQL en WASM). El adaptador `pg` de producción
  compila pero no se ejecutó contra un servidor real.
- `NOT_VERIFIED`: Supabase real (JWKS, `auth.uid()`, rol `authenticated`,
  pooler), Storage, Realtime, búsqueda/vectores, exportaciones, backups, Anam,
  firma, cobro, envío de mensajes, proveedores CRM, despliegue y wiring al padre.
- El repositorio padre no se modificó.

## Auditoría

Codex puede auditar el SHA de la rama con los tres comandos de reproducción y
los informes `C01..C06-REPORT.md`. Un gate que diga PASS sin comando y salida en
su informe debe tratarse como hallazgo.
