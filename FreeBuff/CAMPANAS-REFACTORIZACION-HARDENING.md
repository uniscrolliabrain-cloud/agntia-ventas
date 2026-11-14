# FreeBuff — campaña diferencial de 12 fases, 96 tareas

**Repo:** `uniscrolliabrain-cloud/agntia-ventas`. **Estado verificado por README:** DOCUMENTATION_ONLY; 42 NOT_STARTED. **No ejecutado**. Repositorio actualmente de diseño, no refactorizar código inexistente. Objetivo: primera vertical funcional, segura y probada para instalación aislada futura, NO producción. **Flujo:** lead → oportunidad → quote → aprobación → sink → ACK.

## Baseline obligatorio
Leer README, docs/campaigns/README.md y campaign.json (42 campañas), docs/architecture, contracts, security, release, tests y manifiestos existentes. Fijar SHA de main y correr pruebas disponibles. Contrastar propuestas con el árbol, evitar duplicaciones, mantener decisiones históricas. No modificar /agente, gestoría ni otros repos. Crear `FreeBuff/reportes/00-BASELINE.md` con estado real y plan de patchsets.

## FB-01: inventario y baseline

**Capacidad objetivo:** lead consentido. **Riesgo específico:** spam.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para lead consentido, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo lead consentido y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **spam**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-01-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** lead consentido comprobado con datos sintéticos; spam bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-02: toolchain instalable CI

**Capacidad objetivo:** CRM pipeline. **Riesgo específico:** scraping.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para CRM pipeline, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo CRM pipeline y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **scraping**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-02-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** CRM pipeline comprobado con datos sintéticos; scraping bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-03: identidad Supabase y twins

**Capacidad objetivo:** catálogo. **Riesgo específico:** precios caducados.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para catálogo, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo catálogo y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **precios caducados**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-03-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** catálogo comprobado con datos sintéticos; precios caducados bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-04: contratos Zod, SQL/RLS y outbox

**Capacidad objetivo:** cotización decimal. **Riesgo específico:** descuentos.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para cotización decimal, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo cotización decimal y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **descuentos**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-04-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** cotización decimal comprobado con datos sintéticos; descuentos bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-05: SOP/worker determinista

**Capacidad objetivo:** aprobación. **Riesgo específico:** contratos.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para aprobación, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo aprobación y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **contratos**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-05-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** aprobación comprobado con datos sintéticos; contratos bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-06: vertical dominio sintética

**Capacidad objetivo:** envío sandbox. **Riesgo específico:** doble contacto.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para envío sandbox, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo envío sandbox y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **doble contacto**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-06-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** envío sandbox comprobado con datos sintéticos; doble contacto bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-07: puertos/adaptadores y sandbox

**Capacidad objetivo:** reunión. **Riesgo específico:** spam.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para reunión, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo reunión y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **spam**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-07-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** reunión comprobado con datos sintéticos; spam bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-08: API Hono, SDK y tools

**Capacidad objetivo:** handoff ACK. **Riesgo específico:** scraping.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para handoff ACK, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo handoff ACK y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **scraping**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-08-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** handoff ACK comprobado con datos sintéticos; scraping bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-09: UX, OTel y auditoría

**Capacidad objetivo:** lead consentido. **Riesgo específico:** precios caducados.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para lead consentido, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo lead consentido y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **precios caducados**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-09-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** lead consentido comprobado con datos sintéticos; precios caducados bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-10: hardening adversarial

**Capacidad objetivo:** CRM pipeline. **Riesgo específico:** descuentos.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para CRM pipeline, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo CRM pipeline y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **descuentos**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-10-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** CRM pipeline comprobado con datos sintéticos; descuentos bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-11: Doppler-ready sin credenciales

**Capacidad objetivo:** catálogo. **Riesgo específico:** contratos.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para catálogo, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo catálogo y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **contratos**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-11-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** catálogo comprobado con datos sintéticos; contratos bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## FB-12: release interno y handoff padre

**Capacidad objetivo:** cotización decimal. **Riesgo específico:** doble contacto.

1. Registrar HEAD, scripts, archivos existentes y estado PRESENTE/PARCIAL/AUSENTE de esta fase; enlazar las campañas originales equivalentes.
2. Diseñar entidad, esquema Zod, estado y transición para cotización decimal, con `schemaVersion`, `tenantId`, `actorId`, `resourceId`, `correlationId`, `causationId`, `idempotencyKey`; verificar identidad contra principal autenticado.
3. Definir mapa de archivos exactos antes de escribir: `src/contracts`, `src/domain`, `src/runtime`, `src/adapters`, `src/api`, `tests`, `docs` son propuestas sujetas al árbol real.
4. Implementar patchset mínimo: policy deny-by-default, approvals humanas, transacción con audit append-only y outbox, idempotencia, retries y rollback donde corresponda.
5. Crear fixture positivo cotización decimal y cinco negativos: JWT inválido, tenant ajeno, recurso prohibido, payload inválido, retry duplicado; añadir regresión de **doble contacto**.
6. Simular proveedor caído, timeout, revocación, carrera de dos workers y crash antes/después de commit; demostrar que no duplica efectos.
7. Ejecutar lint, typecheck, build, unit/integration/contract/E2E existentes, pruebas con dos tenants y migraciones reversibles; anotar comandos, exit codes y skips. No afirmar tests inexistentes.
8. Documentar contratos, ADR, rollback, seguridad, coste y resultado en `FreeBuff/reportes/FB-12-REPORT.md` con SHA, PR, paths tocados, diff, evidencia, deuda y estado PASS/PARTIAL/FAIL/BLOCKED. Revisión independiente antes de avanzar.

**Gate:** cotización decimal comprobado con datos sintéticos; doble contacto bloqueado por test adversarial; sin acciones reales ni secretos; reporte y revisión verificables.

## Arquitectura de referencia (ajustar al repo)

Middleware TS/Hono/pnpm, Zod strict, Postgres/Supabase RLS y migraciones; Supabase JWT JWKS/issuer/audience/exp, membership/ACL por recurso, twins delegados desde agentes canónicos en /agente, jamás identidad creada por el LLM. SOP determinista, approval, outbox at-least-once, consumidor idempotente, audit append-only, DLQ, snapshots/replay. Port/adapters para proveedores, fixtures y mocks separados de integraciones reales. Prohibidos tokens en navegador, URL arbitraria, shell, pagos, comunicaciones, publicaciones o actuaciones reguladas.

```ts
import { z } from 'zod';
export const Command = z.object({schemaVersion:z.literal(1),tenantId:z.string(),actorId:z.string(),resourceId:z.string(),correlationId:z.string().uuid(),idempotencyKey:z.string().min(8),capability:z.string(),payload:z.unknown()}).strict();
// El principal del servidor manda; no autorizar por tenantId del payload.
// UNIQUE(tenant_id, capability, idempotency_key), RLS USING/WITH CHECK y outbox transaccional.
```

## Preparación Doppler e integración posterior

FB-11 crea `FreeBuff/DOPPLER-READY.md`: tabla de variables por entorno dev/stg/prod, función, owner, rotación, severidad, secret ref, validación fail-closed y .env.example sin valores; **no** crear proyecto ni claves. FB-12 crea `FreeBuff/INTEGRATION-AGENTE-PROPOSAL.md`: paquete, SDK, Hono, tools, permisos, eventos, outbox, smoke tests, rollback, contrato de twins; **no** tocar /agente. Cierre en `FreeBuff/FOUNDER-FINAL-REPORT.md`: 12 reportes, matriz 42↔12, SHA/PR, tests, SBOM/licencias, restore, deuda P0/P1/P2, coste y decisión founder.
