# VTA-C05 — DTOs, esquemas y errores

**Estado: PASS.** 68 pruebas en el workspace, todas verdes (`pnpm run test`,
exit 0); `pnpm run typecheck`, exit 0.

## Archivos

- `packages/contracts/src/ids.ts` — IDs opacos (no forzados a UUID), ISO-8601 con
  offset, timezone separada.
- `packages/contracts/src/money.ts` — `Money` como string decimal exacto
  (sin exponente ni ceros a la izquierda, máximo 8 decimales), moneda ISO-4217,
  `RoundingPolicy` versionada.
- `packages/contracts/src/errors.ts` — catálogo cerrado de 25 códigos con mapeo
  HTTP 400/401/403/404/409/422/424/429/500/502/503/504 y envelope de error
  sanitizado (`code`, `message`, `correlationId`, `retryable`,
  `reconciliationRequired`, `details`).
- `packages/contracts/src/envelope.ts` — `OperationEnvelope` estricto con
  `schemaVersion: 1`, límite de 64 KiB.
- `packages/contracts/src/results.ts` — `OperationResult` discriminado
  (`confirmed` / `outcome_unknown` / `blocked` / `failed`); `outcome_unknown`
  exige `reconciliationRequired: true` y `retryable: false`.
- `packages/contracts/src/evidence.ts` — `EvidenceRef` con
  `fact|inference|user_assertion|observation`.
- `packages/domain/src/money.ts` — aritmética Decimal (suma, resta, producto
  cantidad×precio con una sola ronda, descuento en puntos básicos, rechazo de
  moneda cruzada y de cantidad inválida).
- `apps/api/src/app.ts` — `POST /v1/ventas/envelopes/validate` (valida, no
  escribe) y envelope de error con `correlationId`.

## Pruebas ejecutadas

| Archivo | Casos | Resultado |
|---|---|---|
| `packages/contracts/src/contracts.test.ts` | 12 | PASS |
| `packages/domain/src/money.test.ts` | 13 | PASS |
| `apps/api/src/app.test.ts` (envelope + routing) | 10 | PASS |

Cobertura relevante:

- moneda: nunca float, nunca exponente, rechazo de `01.00` y de 9 decimales
- envelope: rechazo de claves extra (`role`, `approved`), `schemaVersion` ajeno,
  capability fuera del catálogo, `idempotencyKey` corta, `expectedVersion: 0`,
  payload de más de 64 KiB, JSON malformado
- `correlationId` inválido en cabecera → sustituido por uno del servidor; válido
  → conservado
- ruta desconocida (`/v1/ventas/execute-anything`) → 404 estructurado, sin
  endpoints genéricos
- dinero: `0.1 + 0.2 = 0.3` sin artefacto binario, `19.99 × 3 = 59.97`,
  `HALF_UP` vs `HALF_EVEN` en `1.005`, `0.00000001 × 3` exacto,
  moneda cruzada → `CURRENCY_MISMATCH`, cantidad `0`/`-1`/`2,5`/`1e3` →
  `QUANTITY_INVALID`, política desconocida → `ROUNDING_UNSUPPORTED`

## Defectos reales encontrados por las pruebas y corregidos

1. Expectativa de escala monetaria: la suma conserva la escala más ancha de las
   entradas (`0.1 + 0.2 = 0.3`, no `0.30`). Se documentó la semántica en el test
   en vez de forzar una escala no declarada.
2. El envelope de error perdía las claves rechazadas: `details.issues` solo traía
   `path: ""` y `code: unrecognized_keys`. Se añadió `keys` al detalle para que un
   cliente pueda corregir el payload sin adivinar.

## Pendiente / no verificado

- Validación runtime del lado servidor contra base de datos real (FK/RLS): C06,
  `NOT_VERIFIED` por falta de Postgres accesible.
- `ApprovalBinding`, `CapabilityReport`, `ExternalLink`, `ProposalRevision`:
  contratos diseñados en `docs/contracts/01-contratos.md` y **no** implementados
  todavía; se implementan en C07/C08/C14/C21.
- No hay endpoint de aprobación, envío ni exportación: el catálogo los excluye
  por diseño.

## Siguiente dependencia

C06 (persistencia, RLS y migraciones) — requiere base de datos real; en este
entorno queda `BLOCKED` por permisos de Docker.
