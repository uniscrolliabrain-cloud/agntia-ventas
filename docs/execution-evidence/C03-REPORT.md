# VTA-C03 — Supabase JWT y principal

**Estado: PASS en código y pruebas locales; persistencia real pendiente (C06).**

## Archivos

- `packages/identity/src/jwt.ts` — verificación de firma, `issuer`/`audience`
  exactos, allowlist de algoritmos (`RS256`, `ES256`; `none` rechazado),
  tolerancia de reloj, JWKS fijado por servidor, `sub`/`exp`/`iat` requeridos.
  `user_metadata` se descarta antes de construir el principal.
- `packages/identity/src/principal.ts` — principal solo con membership
  provisionada y activa; rol y scopes desde la membership, nunca del token.
- `packages/contracts/src/principal.ts` + `scopes.ts` — Actor, Membership,
  Principal, `DelegationMandate`, `TwinBinding` con validación runtime.
- `apps/api/src/app.ts` — `GET /v1/ventas/me` con bearer obligatorio.
- `apps/api/src/server.ts` — arranque real; sin almacén de membership la ruta
  autenticada responde 424 en vez de caer a un principal por defecto.

## Pruebas ejecutadas — `pnpm run test`, exit 0

| Archivo | Casos | Resultado |
|---|---|---|
| `packages/identity/src/jwt.test.ts` | 10 | PASS |
| `packages/identity/src/principal.test.ts` | 8 | PASS |
| `apps/api/src/app.test.ts` (auth) | 5 | PASS |

Negativos cubiertos y verdes:

- token firmado por otra clave → `AUTH_INVALID`
- `alg: none` → `AUTH_INVALID`
- issuer ajeno → `AUTH_INVALID`; audience ajena (`service_role`) → `AUTH_INVALID`
- token expirado → `AUTH_EXPIRED`
- token sin `sub`, malformado o con claim de tenant inválido → `AUTH_INVALID`
- `user_metadata` con `tenant_id`/`role` de otro tenant: descartado, el claim
  verificado manda
- JWT válido sin membership → `MEMBERSHIP_REQUIRED`
- membership `suspended`/`revoked` → `MEMBERSHIP_SUSPENDED`
- membership de otro `sub` o de otro tenant → `TENANT_MISMATCH`
- scope ausente → `CAPABILITY_NOT_GRANTED` con `details.missing`
- registro de membership inválido → `DEPENDENCY_UNAVAILABLE` (no se confía en él)
- API: sin token → 401 `AUTH_MISSING`; token no verificado → 401 `AUTH_INVALID`;
  envelope con otro tenant → 403 `TENANT_MISMATCH`; actor suplantado →
  403 `ACTOR_MISMATCH`

## Verificación manual del servidor

`PORT=8787` con `SUPABASE_JWT_ISSUER`/`SUPABASE_JWKS_URL` de prueba:

- `GET /health` → `200 {"status":"ok","service":"agntia-ventas","schemaVersion":1}`
- `GET /v1/ventas/me` sin token → `401 AUTH_MISSING` con `correlationId`
- `GET /v1/ventas/me` con token forjado → `401 AUTH_INVALID`
- proceso detenido después de la comprobación (sin listeners residuales)

## Bloqueos / no verificado

- **`NOT_VERIFIED` — Supabase real:** no se usó ningún proyecto, credencial ni
  token real. No hay prueba contra un JWKS real ni rotación de claves.
- **RLS:** implementada y probada en [C06](C06-REPORT.md) con PostgreSQL real
  embebido (PGlite): RLS forzada, rol no superusuario y dos tenants aislados.
  Contra Supabase real sigue `NOT_VERIFIED`.
- La suite del padre no se ejecuta y no se tocó.

## Siguiente dependencia

C04 (twins y nomenclatura canónica).
