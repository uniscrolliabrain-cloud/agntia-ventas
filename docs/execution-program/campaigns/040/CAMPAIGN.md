# VTA-C40 · Vertical E2E y fallos distribuidos

**DESIGN_ONLY · NOT_STARTED · 40/42.** [Campaña original](../../campaigns/40-vertical-e2e-y-fallos-distribuidos.md).

## Scope y resultado verificable
Construir/verificar vertical e2e y fallos distribuidos para Ventas y operaciones comerciales, preservando: Mock no acredita proveedor real; respuesta correcta no compensa acción prohibida.

**Operación:** `e2e.verify`. **Campos:** fixtureA/B/P, stateBeforeAfter, receipt, replay, revocation. **Invariante:** Mock no acredita proveedor real; respuesta correcta no compensa acción prohibida. **Dependencias:** VTA-C39. **Contrato:** `docs/architecture/02-identidad-twins.md`.

## Archivos y ownership (rutas propuestas, verificar en checkout)
- Dominio/adaptador: `tests/e2e/sales-vertical.test.ts`.
- Contrato: `packages/contracts/src/40.ts` si se define DTO nuevo.
- Ruta: `apps/api/src/routes/40.ts` solo si hay capability nominada y autorizada.
- Test: `tests/campaigns/040.test.ts`, fixtures `tests/fixtures/040/`.
- Evidencias: `docs/implementation/c40/EVIDENCE.md`, `TESTS.md`, `RISKS.md`.
- El manifest original propone artefactos documentales `docs/implementation/c40/README.md`, `docs/implementation/c40/EVIDENCE.md`, `docs/implementation/c40/TESTS.md`, `docs/implementation/c40/RISKS.md`; no confundirlos con implementación.

## Patchsets ordenados
### 040.01 — VTA-C40-T01: Congelar fuentes, ámbito y autoridad
**Acción:** Cotejar fixtureA/B/P, stateBeforeAfter, receipt, replay, revocation con originales, contrato del tenant y versiones de fuente/proveedor. Registrar qué es hecho, declaración, inferencia o desconocido; revisar alcance territorial/temporal y reglas del módulo.

**Implementación localizada:** `tests/e2e/sales-vertical.test.ts` + DTO `packages/contracts/src/40.ts` si corresponde, y tests `tests/campaigns/040.test.ts`. Reutilizar puertos y helpers existentes, sin copiar código de otros dominios. Para investigación, producir informe verificable y no endpoints artificiales.

**Aceptación:** AuthorityMap y fixture explícitos; Mock no acredita proveedor real; respuesta correcta no compensa acción prohibida. La ausencia de fuente genera pendiente, no un valor plausible.

**Verificación:** fixture positivo, acceso tenant ajeno, scope insuficiente, replay y fallo/timeout si hay efecto externo; registrar comandos/SHAs y evidencia. **Depende de:** inicio.

### 040.02 — VTA-C40-T02: Definir DTO y frontera de datos
**Acción:** Diseñar esquema runtime para fixtureA/B/P, stateBeforeAfter, receipt, replay, revocation: tipos, límites, IDs opacos, enums, fechas y versión. Conservar los campos nativos aplicables y declarar nuevos los del servicio. Aislar tenant/proyecto/recurso y minimizar PII.

**Implementación localizada:** `tests/e2e/sales-vertical.test.ts` + DTO `packages/contracts/src/40.ts` si corresponde, y tests `tests/campaigns/040.test.ts`. Reutilizar puertos y helpers existentes, sin copiar código de otros dominios. Para investigación, producir informe verificable y no endpoints artificiales.

**Aceptación:** Round-trip y rechazo de extra/valor inválido; referencias cruzadas no son posibles; source/actor/updatedAt y EvidenceRef preservados donde correspondan.

**Verificación:** fixture positivo, acceso tenant ajeno, scope insuficiente, replay y fallo/timeout si hay efecto externo; registrar comandos/SHAs y evidencia. **Depende de:** VTA-C40-T01.

### 040.03 — VTA-C40-T03: Aplicar lógica determinista y revisión
**Acción:** Implementar o documentar el paso `e2e.verify` mediante guards, estados y expectedVersion/CAS. Separar propuesta del modelo de cálculo/decisión verificables. QuoteTotals: sumar cantidad×precio unitario con Decimal, descuentos según ámbito/orden explícito, moneda/redondeo y tax mapping aprobado por fuentes; no inferir impuestos. Congelar priceBook/version/stock/delivery assertions. Forecast es un snapshot de escenarios, no ingreso cobrado ni garantía.

**Implementación localizada:** `tests/e2e/sales-vertical.test.ts` + DTO `packages/contracts/src/40.ts` si corresponde, y tests `tests/campaigns/040.test.ts`. Reutilizar puertos y helpers existentes, sin copiar código de otros dominios. Para investigación, producir informe verificable y no endpoints artificiales.

**Aceptación:** El estado final, el protegido y los motivos de bloqueo son comprobables; Timeout tras aceptación no duplica tras takeover/retry. No eval/SQL/shell/HTTP genérico del LLM.

**Verificación:** fixture positivo, acceso tenant ajeno, scope insuficiente, replay y fallo/timeout si hay efecto externo; registrar comandos/SHAs y evidencia. **Depende de:** VTA-C40-T02.

### 040.04 — VTA-C40-T04: Adaptar con permisos mínimos
**Acción:** Comprobar versión/edición/ACL de backend si esta fase lo usa; fields/métodos allowlist y binding de servidor. Si es fase local/documental no añadir HTTP. Normalizar errores y limitar IO/tamaño/tiempo/coste de `e2e.verify`.

**Implementación localizada:** `tests/e2e/sales-vertical.test.ts` + DTO `packages/contracts/src/40.ts` si corresponde, y tests `tests/campaigns/040.test.ts`. Reutilizar puertos y helpers existentes, sin copiar código de otros dominios. Para investigación, producir informe verificable y no endpoints artificiales.

**Aceptación:** Unknown/unsupported/forbidden no se simulan como éxito; cero HTTP con principal o conexión no autorizados; prueba fake no habilita capability real.

**Verificación:** fixture positivo, acceso tenant ajeno, scope insuficiente, replay y fallo/timeout si hay efecto externo; registrar comandos/SHAs y evidencia. **Depende de:** VTA-C40-T03.

### 040.05 — VTA-C40-T05: Vincular autorización y efectos
**Acción:** Crear preview sin efecto remoto, diff/hash de datos y revisión; identificar quién acepta el resultado y quién puede ejecutar. Si hay efecto, exigir policy/approval/mandato vigentes y un único intent durable con idempotency key.

**Implementación localizada:** `tests/e2e/sales-vertical.test.ts` + DTO `packages/contracts/src/40.ts` si corresponde, y tests `tests/campaigns/040.test.ts`. Reutilizar puertos y helpers existentes, sin copiar código de otros dominios. Para investigación, producir informe verificable y no endpoints artificiales.

**Aceptación:** Cambiar fixtureA/B/P o materialidad del payload invalida la autorización aplicable. Replay igual no duplica; distinto contenido con misma key da conflicto.

**Verificación:** fixture positivo, acceso tenant ajeno, scope insuficiente, replay y fallo/timeout si hay efecto externo; registrar comandos/SHAs y evidencia. **Depende de:** VTA-C40-T04.

### 040.06 — VTA-C40-T06: Ejecutar pruebas de negocio y fallo
**Acción:** Preparar y ejecutar caso específico: Timeout tras aceptación no duplica tras takeover/retry. Añadir A/B/P, humano/agente/colaborador, revocación, dato sin fuente, cambio concurrente y crash pertinente a `e2e.verify`. Verificar ausencia de efectos prohibidos: Un descuento prometido por el modelo supera el mandato o se manda un seguimiento tras oposición.

**Implementación localizada:** `tests/e2e/sales-vertical.test.ts` + DTO `packages/contracts/src/40.ts` si corresponde, y tests `tests/campaigns/040.test.ts`. Reutilizar puertos y helpers existentes, sin copiar código de otros dominios. Para investigación, producir informe verificable y no endpoints artificiales.

**Aceptación:** El contrato estricto exige resultado correcto y trayectoria segura. Test fallido crítico bloquea; sin entorno se registra NOT_VERIFIED, nunca PASS por un mock.

**Verificación:** fixture positivo, acceso tenant ajeno, scope insuficiente, replay y fallo/timeout si hay efecto externo; registrar comandos/SHAs y evidencia. **Depende de:** VTA-C40-T05.

### 040.07 — VTA-C40-T07: Registrar evidencia y cerrar gate
**Acción:** Guardar SHA/diff, versiones, fixture antes/después, actor/mandato/correlación, fuentes y receipts mínimos. Registrar tests reales y coste/latencia cuando existan. Actualizar riesgos, rollback y siguiente dependencia sin escribir en agente.

**Implementación localizada:** `tests/e2e/sales-vertical.test.ts` + DTO `packages/contracts/src/40.ts` si corresponde, y tests `tests/campaigns/040.test.ts`. Reutilizar puertos y helpers existentes, sin copiar código de otros dominios. Para investigación, producir informe verificable y no endpoints artificiales.

**Aceptación:** EVIDENCE/TESTS/RISKS y decisión de gate revisables; ninguna cifra, firma, actividad o integración inventadas. Mantener fuera del repo público PII, credenciales y originales restringidos.

**Verificación:** fixture positivo, acceso tenant ajeno, scope insuficiente, replay y fallo/timeout si hay efecto externo; registrar comandos/SHAs y evidencia. **Depende de:** VTA-C40-T06.


## Wiring transversal
Principal verificado (Supabase JWT, membership, recurso y campo) → capability tipada → policy/AuthorityMap → revisión/approval y FSM → transacción audit/outbox → worker delegado → adaptador allowlist → receipt/unknown outcome reconciliado → evento puente del padre versionado. Para etapas sin efecto, NO_APLICA con justificación. CRM/pricebook/firma/calendario no conceden autoridad de cobro ni envío por sí mismos. Ningún scraping o envío comercial sin base legal, oposición y aprobación.

## Gates
- **VTA-C40-G01 / NOT_EXECUTED:** Timeout tras aceptación no duplica tras takeover/retry. Esperado: Resultado y estado protegido coherentes con invariante, revisión/receipt donde correspondan.
- **VTA-C40-G02 / NOT_EXECUTED:** Principal/mandato inválido, recurso o conexión de otro tenant, o versión cambiada intenta e2e.verify.. Esperado: Fail-closed antes de leer/actuar remotamente; sin fuga o ampliación de scope, con intento auditado.

**Bloqueos:** Cross-tenant o secretos expuestos; Approval/mandato/scope ampliados sin autorización; Pérdida de historia o duplicación tras timeout; Conclusión sensible sin fuentes/revisión competente.

**Rollback:** Deshabilitar capacidad o flag y detener efectos nuevos; conservar audit, links, intents, snapshots y receipts. Restore probado con restricciones/supresiones reaplicadas; no borrar efectos remotos para fingir reversión.

## Handoff Freebuff
Commit de campaña con diff, rutas finales, tests, fixtures, evidencia por tarea y gate, riesgos, migrations, flags y rollback. Continuar de forma asíncrona con la siguiente campaña cuando sus dependencias técnicas estén satisfechas; no esperar Codex entre campañas. Codex audita después de la pasada integral.
