# Handoff de ejecución — fundaciones C01–C06

Rama aislada: `impl/factory-c01-c05` (no se ha escrito en `main`).
SHA base: `3e9ae1c8bc28b3a37741eb36a77c1235e523e7b8`.
SHA de implementación: `73c9949` (`feat(persistence): C06 migrations with forced RLS…`).
Historial de la rama: `9d04e72` (C01–C05) → `e57df78` (evidencia) → `73c9949` (C06).

## Reproducción

```bash
pnpm install            # exit 0, lockfile pnpm-lock.yaml
pnpm run typecheck      # exit 0 (contracts, domain, identity, persistence, api)
pnpm run test           # exit 0, 89 tests / 10 archivos
```

Conteo por paquete: contracts 12, domain 13, identity 28, persistence 16, api 20.

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
