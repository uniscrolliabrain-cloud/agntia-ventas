# Handoff de ejecución — fundaciones C01–C05

Rama aislada: `impl/factory-c01-c05` (no se ha escrito en `main`).
SHA base: `3e9ae1c8bc28b3a37741eb36a77c1235e523e7b8`.
SHA de implementación: `9d04e72fe6d2c87568f871b3a791b52626eb8e9f`.

## Reproducción

```bash
pnpm install            # exit 0, lockfile pnpm-lock.yaml
pnpm run typecheck      # exit 0 (contracts, domain, identity, api)
pnpm run test           # exit 0, 68 tests / 6 archivos
```

Conteo por archivo: `apps/api/src/app.test.ts` 15, `contracts.test.ts` 12,
`money.test.ts` 13, `jwt.test.ts` 10, `mandate.test.ts` 10, `principal.test.ts` 8.

## Smoke de servidor (ejecutado, luego detenido)

```bash
SUPABASE_JWT_ISSUER=... SUPABASE_JWKS_URL=... PORT=8787 pnpm run dev
curl /health                     # 200 {"status":"ok",...}
curl /v1/ventas/me               # 401 AUTH_MISSING + correlationId
curl -H 'Authorization: Bearer aaa.bbb.ccc' /v1/ventas/me   # 401 AUTH_INVALID
```

## Estado honesto

- Implementado y probado: C01 (baseline), C02 (autoridad, parcial), C03 (JWT y
  principal), C04 (twins/mandatos), C05 (DTOs, errores, dinero Decimal).
- `PARTIAL`: C01 y C02 (les falta persistencia y DTOs de contrato SaaS).
- `BLOCKED`: C06 en adelante por persistencia; `docker` sin permisos impide
  Postgres/RLS local, así que toda prueba de base de datos es `NOT_VERIFIED`.
- Nunca ejecutado: proveedores reales, Supabase real, Anam, firma, cobro,
  envío de mensajes, despliegue, wiring al padre.
- El repositorio padre no se modificó.

## Auditoría

Codex puede auditar este SHA con los tres comandos de reproducción y leer los
informes `C01..C05-REPORT.md`. Cualquier desviación respecto a los invariantes
del programa debe tratarse como hallazgo, no como documentación pendiente.
