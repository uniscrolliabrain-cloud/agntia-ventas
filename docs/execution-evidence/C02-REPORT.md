# VTA-C02 — Autoridad por dominio y contrato SaaS

**Estado: PARTIAL.** Fecha: 2026-11-15. Rama `impl/factory-c01-c05`.

## Artefactos

- `docs/architecture/05-authority-map.md` — custodio de campo y ejecutor único
  por efecto, con precondición y prueba de resultado por capacidad.
- `packages/contracts/src/capabilities.ts` — catálogo cerrado de capacidades
  (internas + producto), separación de la superficie del modelo y lista inicial
  de 7 tools de solo lectura/propuesta.
- `packages/contracts/src/scopes.ts` — scope obligatorio `recurso:acción`.

## Decisiones registradas

1. Las tareas de baseline/administración (`baseline.capture`, `storage.migrate`,
   `provider.discover`, `auth.verify`, `twin.bind`, `contracts.validate`,
   `sdk.contract`, `host.bridge`, `release.prepare`, `pilot.accept`,
   `security.verify`, `e2e.verify`, `usage.measure`) **no** son superficie del
   modelo.
2. Aprobar, enviar, firmar, cobrar, exportar todo o administrar queda fuera del
   catálogo inicial: es un acto humano ligado a `ApprovalBinding`.
3. Un dato registrado (contacto, lead, persona) no es usuario autenticado; el
   acceso exige membership + scope de recurso/campo.

## Pruebas ejecutadas

`packages/contracts/src/contracts.test.ts` (3 casos relevantes a esta campaña):

- el catálogo es cerrado y rechaza `sales.execute-anything`: **PASS**
- baseline/administración no es superficie del modelo: **PASS**
- `sales.approve.*` y `sales.send.*` no son superficie del modelo: **PASS**
- scope `recurso:acción` obligatorio (rechaza `sales`, `Sales:read`): **PASS**

## Pendiente / no verificado

- `ServiceAgreement` / `WorkOrder` como DTO runtime con entitlements: **pendiente
  (C06–C07)**. Sin ellos no hay contrato de tenant persistido.
- AuthorityMap persistido y consultable: pendiente (C06).
- Autoridad real de cada hermano (Marketing, Clientes, Finanzas, Gestoría):
  `NOT_VERIFIED` — depende de contratos que no viven en este repositorio.

## Siguiente dependencia

C03 (Supabase JWT y principal).
