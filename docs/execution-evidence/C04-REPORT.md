# VTA-C04 — Twins y nomenclatura canónica

**Estado: PASS en validación de mandato y binding; bridge con el padre no probado.**

## Archivos

- `packages/contracts/src/principal.ts` — `TwinBinding` (referencia canónica,
  revisión, instancia local, tenant objetivo, work order, capabilities,
  propósito, emisión/caducidad, versión de revocación, prueba) y
  `DelegationMandate` (actor y tenant de origen **separados** del objetivo).
- `packages/identity/src/mandate.ts` — `assertMandateAllowsWork`, fail-closed
  antes de cualquier efecto, revalidable por cada job de worker.

## Reglas implementadas y probadas

| Comprobación | Código de error |
|---|---|
| Mandato caducado | `MANDATE_EXPIRED` |
| Mandato aún no válido | `MANDATE_INVALID` |
| Versión de revocación desactualizada | `MANDATE_REVOKED` |
| Mandato atado a otro twin | `MANDATE_INVALID` |
| Tenant objetivo distinto del binding | `TENANT_MISMATCH` |
| Capacidad que el twin no tiene (widening) | `CAPABILITY_WIDENING` |
| Capacidad pedida fuera del mandato | `CAPABILITY_NOT_GRANTED` |
| Delegación cross-tenant sin work order | `MANDATE_INVALID` |
| Presupuesto no positivo | `MANDATE_INVALID` |

Además: `mandateDataScope()` devuelve el tenant objetivo sin reescribir
`originatingTenantId`, de modo que el actor de origen y el ámbito de datos nunca
se sobrescriben entre sí.

## Pruebas ejecutadas

`packages/identity/src/mandate.test.ts` — **10 casos, todos PASS** (`pnpm run test`,
exit 0). Incluye el caso positivo (mandato vivo, twin correcto, capability
dentro de alcance) y cada negativo de la tabla anterior, más la verificación de
que el origen no se muta.

## Bloqueos / no verificado

- **`NOT_VERIFIED` — `HOST_BRIDGE_NOT_VERIFIED`:** el padre
  (`uniscrolliabrain-cloud/agente`) no ofrece aquí un puerto de delegación
  probado; el mandato es un contrato local. No se editó el padre, no se
  inventaron claims ni enum nativos, y no se declara equivalencia con
  `Actor`/`capability.ts` del host.
- **`NOT_VERIFIED` — firma del mandato:** `proofRef` es una referencia; no hay
  verificación criptográfica de la prueba ni rotación.
- Catálogo efectivo del padre (índice 12 vs catálogo 16): sigue siendo
  discrepancia documental, no ejecución probada.

## Siguiente dependencia

C05 (DTOs, esquemas y errores).
