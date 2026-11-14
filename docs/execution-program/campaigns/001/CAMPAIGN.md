# VTA-C01 · Baseline, fuentes y alcance

**DESIGN_ONLY · NOT_STARTED · 1/42.** Original: [docs/campaigns/01-baseline-fuentes-y-alcance.md](../../campaigns/01-baseline-fuentes-y-alcance.md).

## Scope y resultado verificable
Construir/verificar baseline, fuentes y alcance para Ventas y operaciones comerciales, preservando: No modificar agente ni convertir documentos en pruebas pasadas.

**Operación propuesta:** `baseline.capture`. **Campos/refs:** hostSHA, ownSHA, sourceRef, version, permissions. **Invariante:** No modificar agente ni convertir documentos en pruebas pasadas. **Dependencias:** ninguna. **Contrato:** `docs/architecture/02-identidad-twins.md`.

## Superficies de código (propuestas, no existentes)
- **Owner primario:** `docs/baseline.md` — implementar el dominio de esta campaña, sin duplicar el servicio padre.
- **Frontera HTTP:** `apps/api/src/routes/01.ts` solo si es una capability pública autorizada; para baseline, investigación o documentación, NO_APLICA.
- **Contrato runtime:** `packages/contracts/src/01.ts` solo si existen DTOs nuevos.
- **Pruebas:** `tests/campaigns/001.test.ts`, fixtures sintéticos en `tests/fixtures/001/`.
- **Evidencia:** `docs/implementation/c01/EVIDENCE.md`, `TESTS.md`, `RISKS.md`.
- **Nota:** `docs/implementation/c01/README.md` es documental; no es el código funcional. Validar estructura y paquetes reales en C01 antes de crear estas rutas. No cambiar rutas de otras campañas sin registrar dependencia.

## Patchsets completos de esta campaña
### 001.01 — VTA-C01-T01: Congelar fuentes, ámbito y autoridad

**Implementación:** Cotejar hostSHA, ownSHA, sourceRef, version, permissions con originales, contrato del tenant y versiones de fuente/proveedor. Registrar qué es hecho, declaración, inferencia o desconocido; revisar alcance territorial/temporal y reglas del módulo.

**Superficie principal:** `docs/baseline.md`; contrato `packages/contracts/src/01.ts` si aplica; evidencia `docs/implementation/c01/EVIDENCE.md`. Primero comprobar imports y exports de dependencias. Si la acción no requiere código, entregar decisión y fixture, no endpoint inventado.

**Acceptance:** AuthorityMap y fixture explícitos; No modificar agente ni convertir documentos en pruebas pasadas. La ausencia de fuente genera pendiente, no un valor plausible.

**Test:** caso positivo + caso negativo de scope/tenant + revisión/idempotencia/fallo remoto según efecto; registrar comando y SHA. **Dependencia:** inicio.

### 001.02 — VTA-C01-T02: Definir DTO y frontera de datos

**Implementación:** Diseñar esquema runtime para hostSHA, ownSHA, sourceRef, version, permissions: tipos, límites, IDs opacos, enums, fechas y versión. Conservar los campos nativos aplicables y declarar nuevos los del servicio. Aislar tenant/proyecto/recurso y minimizar PII.

**Superficie principal:** `docs/baseline.md`; contrato `packages/contracts/src/01.ts` si aplica; evidencia `docs/implementation/c01/EVIDENCE.md`. Primero comprobar imports y exports de dependencias. Si la acción no requiere código, entregar decisión y fixture, no endpoint inventado.

**Acceptance:** Round-trip y rechazo de extra/valor inválido; referencias cruzadas no son posibles; source/actor/updatedAt y EvidenceRef preservados donde correspondan.

**Test:** caso positivo + caso negativo de scope/tenant + revisión/idempotencia/fallo remoto según efecto; registrar comando y SHA. **Dependencia:** VTA-C01-T01.

### 001.03 — VTA-C01-T03: Aplicar lógica determinista y revisión

**Implementación:** Implementar o documentar el paso `baseline.capture` mediante guards, estados y expectedVersion/CAS. Separar propuesta del modelo de cálculo/decisión verificables. QuoteTotals: sumar cantidad×precio unitario con Decimal, descuentos según ámbito/orden explícito, moneda/redondeo y tax mapping aprobado por fuentes; no inferir impuestos. Congelar priceBook/version/stock/delivery assertions. Forecast es un snapshot de escenarios, no ingreso cobrado ni garantía.

**Superficie principal:** `docs/baseline.md`; contrato `packages/contracts/src/01.ts` si aplica; evidencia `docs/implementation/c01/EVIDENCE.md`. Primero comprobar imports y exports de dependencias. Si la acción no requiere código, entregar decisión y fixture, no endpoint inventado.

**Acceptance:** El estado final, el protegido y los motivos de bloqueo son comprobables; Cambio del padre obliga cotejar antes de integrar. No eval/SQL/shell/HTTP genérico del LLM.

**Test:** caso positivo + caso negativo de scope/tenant + revisión/idempotencia/fallo remoto según efecto; registrar comando y SHA. **Dependencia:** VTA-C01-T02.

### 001.04 — VTA-C01-T04: Adaptar con permisos mínimos

**Implementación:** Comprobar versión/edición/ACL de backend si esta fase lo usa; fields/métodos allowlist y binding de servidor. Si es fase local/documental no añadir HTTP. Normalizar errores y limitar IO/tamaño/tiempo/coste de `baseline.capture`.

**Superficie principal:** `docs/baseline.md`; contrato `packages/contracts/src/01.ts` si aplica; evidencia `docs/implementation/c01/EVIDENCE.md`. Primero comprobar imports y exports de dependencias. Si la acción no requiere código, entregar decisión y fixture, no endpoint inventado.

**Acceptance:** Unknown/unsupported/forbidden no se simulan como éxito; cero HTTP con principal o conexión no autorizados; prueba fake no habilita capability real.

**Test:** caso positivo + caso negativo de scope/tenant + revisión/idempotencia/fallo remoto según efecto; registrar comando y SHA. **Dependencia:** VTA-C01-T03.

### 001.05 — VTA-C01-T05: Vincular autorización y efectos

**Implementación:** Crear preview sin efecto remoto, diff/hash de datos y revisión; identificar quién acepta el resultado y quién puede ejecutar. Si hay efecto, exigir policy/approval/mandato vigentes y un único intent durable con idempotency key.

**Superficie principal:** `docs/baseline.md`; contrato `packages/contracts/src/01.ts` si aplica; evidencia `docs/implementation/c01/EVIDENCE.md`. Primero comprobar imports y exports de dependencias. Si la acción no requiere código, entregar decisión y fixture, no endpoint inventado.

**Acceptance:** Cambiar hostSHA o materialidad del payload invalida la autorización aplicable. Replay igual no duplica; distinto contenido con misma key da conflicto.

**Test:** caso positivo + caso negativo de scope/tenant + revisión/idempotencia/fallo remoto según efecto; registrar comando y SHA. **Dependencia:** VTA-C01-T04.

### 001.06 — VTA-C01-T06: Ejecutar pruebas de negocio y fallo

**Implementación:** Preparar y ejecutar caso específico: Cambio del padre obliga cotejar antes de integrar. Añadir A/B/P, humano/agente/colaborador, revocación, dato sin fuente, cambio concurrente y crash pertinente a `baseline.capture`. Verificar ausencia de efectos prohibidos: Un descuento prometido por el modelo supera el mandato o se manda un seguimiento tras oposición.

**Superficie principal:** `docs/baseline.md`; contrato `packages/contracts/src/01.ts` si aplica; evidencia `docs/implementation/c01/EVIDENCE.md`. Primero comprobar imports y exports de dependencias. Si la acción no requiere código, entregar decisión y fixture, no endpoint inventado.

**Acceptance:** El contrato estricto exige resultado correcto y trayectoria segura. Test fallido crítico bloquea; sin entorno se registra NOT_VERIFIED, nunca PASS por un mock.

**Test:** caso positivo + caso negativo de scope/tenant + revisión/idempotencia/fallo remoto según efecto; registrar comando y SHA. **Dependencia:** VTA-C01-T05.

### 001.07 — VTA-C01-T07: Registrar evidencia y cerrar gate

**Implementación:** Guardar SHA/diff, versiones, fixture antes/después, actor/mandato/correlación, fuentes y receipts mínimos. Registrar tests reales y coste/latencia cuando existan. Actualizar riesgos, rollback y siguiente dependencia sin escribir en agente.

**Superficie principal:** `docs/baseline.md`; contrato `packages/contracts/src/01.ts` si aplica; evidencia `docs/implementation/c01/EVIDENCE.md`. Primero comprobar imports y exports de dependencias. Si la acción no requiere código, entregar decisión y fixture, no endpoint inventado.

**Acceptance:** EVIDENCE/TESTS/RISKS y decisión de gate revisables; ninguna cifra, firma, actividad o integración inventadas. Mantener fuera del repo público PII, credenciales y originales restringidos.

**Test:** caso positivo + caso negativo de scope/tenant + revisión/idempotencia/fallo remoto según efecto; registrar comando y SHA. **Dependencia:** VTA-C01-T06.


## Wiring obligatorio
API Hono nominada → Supabase JWT+membership verificada → Actor y targetTenant por mandato → Zod DTO → AuthorityMap y policy → FSM/revisión → Postgres/RLS + audit/outbox → worker scoped → proveedor allowlist → receipt y reconciliación → bridge de eventos al padre versionado. Para fases documentales marcar explícitamente NO_APLICA. El modelo solo propone; no puede ejecutar HTTP/SQL/shell/MCP arbitrario. Descuentos, firma, pagos, contacto comercial y compromisos de entrega necesitan capacidades y autorizaciones independientes.

## Gates no ejecutados
- **VTA-C01-G01:** Cambio del padre obliga cotejar antes de integrar. **Esperado:** Resultado y estado protegido coherentes con invariante, revisión/receipt donde correspondan.
- **VTA-C01-G02:** Principal/mandato inválido, recurso o conexión de otro tenant, o versión cambiada intenta baseline.capture.. **Esperado:** Fail-closed antes de leer/actuar remotamente; sin fuga o ampliación de scope, con intento auditado.

**Bloqueos:** Cross-tenant o secretos expuestos; Approval/mandato/scope ampliados sin autorización; Pérdida de historia o duplicación tras timeout; Conclusión sensible sin fuentes/revisión competente.

**Rollback:** Deshabilitar capacidad o flag y detener efectos nuevos; conservar audit, links, intents, snapshots y receipts. Restore probado con restricciones/supresiones reaplicadas; no borrar efectos remotos para fingir reversión.

## Handoff Freebuff
Implementar en secuencia, registrar diff y SHA, artefactos reales, test command, evidencia y status por tarea/gate. Seguir con campaña siguiente sin solicitar un nuevo diseño ni esperar auditoría externa; si una integración real está bloqueada, marcarla BLOCKED y continuar con trabajo independiente. Codex audita el conjunto al terminar las 42 campañas.
