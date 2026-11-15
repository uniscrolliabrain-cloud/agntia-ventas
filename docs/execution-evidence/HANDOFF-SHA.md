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
pnpm run test           # exit 0, 176 tests / 19 archivos
```

Conteo por paquete: contracts 12, domain 13, identity 28, sales 81,
persistence 22, api 20.

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
  25 campañas IMPLEMENTED con pruebas, 4 PARTIAL, 6 STUB que fallan cerrado
  (CRM, firma, checkout, portal/Anam, bridge, CI/backup) y C42 documental.
  `db/migrations/0002_domain.sql` añade 10 tablas de dominio con FKs compuestas
  y RLS forzada, probadas en `domain-rls.test.ts`.
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
