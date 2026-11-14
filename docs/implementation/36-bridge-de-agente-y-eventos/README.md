# VTA-C36 — Bridge de agente y eventos

**SCAFFOLD CONCEPTUAL / NOT_STARTED / NOT_EXECUTED.** [Original](../../campaigns/36-bridge-de-agente-y-eventos.md). Leer [factory](../../factory/00-README.md), [pipeline](../../factory/01-PIPELINE.md), [léxico](../../factory/02-LEXICO.md), [ADTC](../../factory/03-TRACE-OBSERVABILITY.md), [producto Ventas](../../factory/04-PRODUCTO-VENTAS.md) y N−1/N/N+1.

## Objetivo
Construir/verificar bridge de agente y eventos para Ventas y operaciones comerciales, preservando: Solo patch propuesto/documentado; cero escrituras al padre.

## Alcance
Campos/refs a resolver: SystemEvent1.0, emittedAt, owner, source, domainEventId. Operación interna o capacidad nominada propuesta `host.bridge`; no se expone por defecto como endpoint/tool si es tarea de baseline/administración.

Operación `host.bridge`; campos `SystemEvent1.0, emittedAt, owner, source, domainEventId`; fuentes H01, S01, S02, P01; dependencias VTA-C35.

## Invariante
Solo patch propuesto/documentado; cero escrituras al padre

## Tareas originales sin granularizar
- **VTA-C36-T01 Congelar fuentes, ámbito y autoridad:** Cotejar SystemEvent1.0, emittedAt, owner, source, domainEventId con originales, contrato del tenant y versiones de fuente/proveedor. Registrar qué es hecho, declaración, inferencia o desconocido; revisar alcance territorial/temporal y reglas del módulo. **Criterio:** AuthorityMap y fixture explícitos; Solo patch propuesto/documentado; cero escrituras al padre. La ausencia de fuente genera pendiente, no un valor plausible.
- **VTA-C36-T02 Definir DTO y frontera de datos:** Diseñar esquema runtime para SystemEvent1.0, emittedAt, owner, source, domainEventId: tipos, límites, IDs opacos, enums, fechas y versión. Conservar los campos nativos aplicables y declarar nuevos los del servicio. Aislar tenant/proyecto/recurso y minimizar PII. **Criterio:** Round-trip y rechazo de extra/valor inválido; referencias cruzadas no son posibles; source/actor/updatedAt y EvidenceRef preservados donde correspondan.
- **VTA-C36-T03 Aplicar lógica determinista y revisión:** Implementar o documentar el paso `host.bridge` mediante guards, estados y expectedVersion/CAS. Separar propuesta del modelo de cálculo/decisión verificables. QuoteTotals: sumar cantidad×precio unitario con Decimal, descuentos según ámbito/orden explícito, moneda/redondeo y tax mapping aprobado por fuentes; no inferir impuestos. Congelar priceBook/version/stock/delivery assertions. Forecast es un snapshot de escenarios, no ingreso cobrado ni garantía. **Criterio:** El estado final, el protegido y los motivos de bloqueo son comprobables; Evento nuevo no se envía como enum nativo inventado. No eval/SQL/shell/HTTP genérico del LLM.
- **VTA-C36-T04 Adaptar con permisos mínimos:** Comprobar versión/edición/ACL de backend si esta fase lo usa; fields/métodos allowlist y binding de servidor. Si es fase local/documental no añadir HTTP. Normalizar errores y limitar IO/tamaño/tiempo/coste de `host.bridge`. **Criterio:** Unknown/unsupported/forbidden no se simulan como éxito; cero HTTP con principal o conexión no autorizados; prueba fake no habilita capability real.
- **VTA-C36-T05 Vincular autorización y efectos:** Crear preview sin efecto remoto, diff/hash de datos y revisión; identificar quién acepta el resultado y quién puede ejecutar. Si hay efecto, exigir policy/approval/mandato vigentes y un único intent durable con idempotency key. **Criterio:** Cambiar SystemEvent1.0 o materialidad del payload invalida la autorización aplicable. Replay igual no duplica; distinto contenido con misma key da conflicto.
- **VTA-C36-T06 Ejecutar pruebas de negocio y fallo:** Preparar y ejecutar caso específico: Evento nuevo no se envía como enum nativo inventado. Añadir A/B/P, humano/agente/colaborador, revocación, dato sin fuente, cambio concurrente y crash pertinente a `host.bridge`. Verificar ausencia de efectos prohibidos: Un descuento prometido por el modelo supera el mandato o se manda un seguimiento tras oposición. **Criterio:** El contrato estricto exige resultado correcto y trayectoria segura. Test fallido crítico bloquea; sin entorno se registra NOT_VERIFIED, nunca PASS por un mock.
- **VTA-C36-T07 Registrar evidencia y cerrar gate:** Guardar SHA/diff, versiones, fixture antes/después, actor/mandato/correlación, fuentes y receipts mínimos. Registrar tests reales y coste/latencia cuando existan. Actualizar riesgos, rollback y siguiente dependencia sin escribir en agente. **Criterio:** EVIDENCE/TESTS/RISKS y decisión de gate revisables; ninguna cifra, firma, actividad o integración inventadas. Mantener fuera del repo público PII, credenciales y originales restringidos.

## Gates diseñados, no ejecutados
- VTA-C36-G01: Evento nuevo no se envía como enum nativo inventado — Resultado y estado protegido coherentes con invariante, revisión/receipt donde correspondan.
- VTA-C36-G02: Principal/mandato inválido, recurso o conexión de otro tenant, o versión cambiada intenta host.bridge. — Fail-closed antes de leer/actuar remotamente; sin fuga o ampliación de scope, con intento auditado.

## Después
Meta-auditoría conceptual libre → reconciliación → patchsets, handoffs específicos Freebuff/Codex/Architect+Founder, tests y evidencias. Rollback: Deshabilitar capacidad o flag y detener efectos nuevos; conservar audit, links, intents, snapshots y receipts. Restore probado con restricciones/supresiones reaplicadas; no borrar efectos remotos para fingir reversión.
