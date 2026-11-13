# VTA-C26 · Inbox y toma humana

Estado **NOT_STARTED**; pruebas **NOT_EXECUTED**.
Secuencia 26/42. Dependencias: VTA-C25.

## Objetivo, datos y límites

Construir/verificar inbox y toma humana para Ventas y operaciones comerciales, preservando: Una nota interna no sale a destinatario externo.

Campos/refs a resolver: threadRef, internalNote, handoffState, ownerRef. Operación interna o capacidad nominada propuesta `sales.handoff.preview`; no se expone por defecto como endpoint/tool si es tarea de baseline/administración.

Invariante: **Una nota interna no sale a destinatario externo**.

La ruta de esta campaña es un documento de trabajo para otra IA; los artefactos siguientes son futuros, no implementación existente. No modificar `/agente`, repos hermanos, producción o secretos. Baseline/administración no se convierten en nuevas tools del modelo. Cotejar SHA propio/padre/upstream e instrucciones antes de codificar.

Supabase JWT, membership y ACL de recursos/campos obligatorios en todos los modos. Agente canónico en padre, twin especializado aquí, mandato vigente y tenant de origen/objetivo separados. Mantener nomenclatura/procedencia real; nuevos campos del servicio se declaran nuevos. El portal externo no crea otro registro agéntico soberano.

## Artefactos propuestos

- `docs/implementation/c26/README.md`
- `docs/implementation/c26/EVIDENCE.md`
- `docs/implementation/c26/TESTS.md`
- `docs/implementation/c26/RISKS.md`

## Tareas granulares

### VTA-C26-T01 · Congelar fuentes, ámbito y autoridad

Cotejar threadRef, internalNote, handoffState, ownerRef con originales, contrato del tenant y versiones de fuente/proveedor. Registrar qué es hecho, declaración, inferencia o desconocido; revisar alcance territorial/temporal y reglas del módulo.

Aceptación: AuthorityMap y fixture explícitos; Una nota interna no sale a destinatario externo. La ausencia de fuente genera pendiente, no un valor plausible.

Evidencia pendiente: salida real sanitizada, fixture y referencia a SHA/estado. Un resultado esperado descrito aquí no es un test ejecutado.

### VTA-C26-T02 · Definir DTO y frontera de datos

Diseñar esquema runtime para threadRef, internalNote, handoffState, ownerRef: tipos, límites, IDs opacos, enums, fechas y versión. Conservar los campos nativos aplicables y declarar nuevos los del servicio. Aislar tenant/proyecto/recurso y minimizar PII.

Aceptación: Round-trip y rechazo de extra/valor inválido; referencias cruzadas no son posibles; source/actor/updatedAt y EvidenceRef preservados donde correspondan.

Evidencia pendiente: salida real sanitizada, fixture y referencia a SHA/estado. Un resultado esperado descrito aquí no es un test ejecutado.

### VTA-C26-T03 · Aplicar lógica determinista y revisión

Implementar o documentar el paso `sales.handoff.preview` mediante guards, estados y expectedVersion/CAS. Separar propuesta del modelo de cálculo/decisión verificables. QuoteTotals: sumar cantidad×precio unitario con Decimal, descuentos según ámbito/orden explícito, moneda/redondeo y tax mapping aprobado por fuentes; no inferir impuestos. Congelar priceBook/version/stock/delivery assertions. Forecast es un snapshot de escenarios, no ingreso cobrado ni garantía.

Aceptación: El estado final, el protegido y los motivos de bloqueo son comprobables; Humano toma control y job del twin no manda respuesta tardía. No eval/SQL/shell/HTTP genérico del LLM.

Evidencia pendiente: salida real sanitizada, fixture y referencia a SHA/estado. Un resultado esperado descrito aquí no es un test ejecutado.

### VTA-C26-T04 · Adaptar con permisos mínimos

Comprobar versión/edición/ACL de backend si esta fase lo usa; fields/métodos allowlist y binding de servidor. Si es fase local/documental no añadir HTTP. Normalizar errores y limitar IO/tamaño/tiempo/coste de `sales.handoff.preview`.

Aceptación: Unknown/unsupported/forbidden no se simulan como éxito; cero HTTP con principal o conexión no autorizados; prueba fake no habilita capability real.

Evidencia pendiente: salida real sanitizada, fixture y referencia a SHA/estado. Un resultado esperado descrito aquí no es un test ejecutado.

### VTA-C26-T05 · Vincular autorización y efectos

Crear preview sin efecto remoto, diff/hash de datos y revisión; identificar quién acepta el resultado y quién puede ejecutar. Si hay efecto, exigir policy/approval/mandato vigentes y un único intent durable con idempotency key.

Aceptación: Cambiar threadRef o materialidad del payload invalida la autorización aplicable. Replay igual no duplica; distinto contenido con misma key da conflicto.

Evidencia pendiente: salida real sanitizada, fixture y referencia a SHA/estado. Un resultado esperado descrito aquí no es un test ejecutado.

### VTA-C26-T06 · Ejecutar pruebas de negocio y fallo

Preparar y ejecutar caso específico: Humano toma control y job del twin no manda respuesta tardía. Añadir A/B/P, humano/agente/colaborador, revocación, dato sin fuente, cambio concurrente y crash pertinente a `sales.handoff.preview`. Verificar ausencia de efectos prohibidos: Un descuento prometido por el modelo supera el mandato o se manda un seguimiento tras oposición.

Aceptación: El contrato estricto exige resultado correcto y trayectoria segura. Test fallido crítico bloquea; sin entorno se registra NOT_VERIFIED, nunca PASS por un mock.

Evidencia pendiente: salida real sanitizada, fixture y referencia a SHA/estado. Un resultado esperado descrito aquí no es un test ejecutado.

### VTA-C26-T07 · Registrar evidencia y cerrar gate

Guardar SHA/diff, versiones, fixture antes/después, actor/mandato/correlación, fuentes y receipts mínimos. Registrar tests reales y coste/latencia cuando existan. Actualizar riesgos, rollback y siguiente dependencia sin escribir en agente.

Aceptación: EVIDENCE/TESTS/RISKS y decisión de gate revisables; ninguna cifra, firma, actividad o integración inventadas. Mantener fuera del repo público PII, credenciales y originales restringidos.

Evidencia pendiente: salida real sanitizada, fixture y referencia a SHA/estado. Un resultado esperado descrito aquí no es un test ejecutado.

## Gates específicos

- **VTA-C26-G01 — NOT_EXECUTED.** Humano toma control y job del twin no manda respuesta tardía Esperado: Resultado y estado protegido coherentes con invariante, revisión/receipt donde correspondan.
- **VTA-C26-G02 — NOT_EXECUTED.** Principal/mandato inválido, recurso o conexión de otro tenant, o versión cambiada intenta sales.handoff.preview. Esperado: Fail-closed antes de leer/actuar remotamente; sin fuga o ampliación de scope, con intento auditado.

Gate de negocio de esta fase y límite transversal: Sin mensajes comerciales reales, alta automática de leads por scraping, firma/contrato, cobro, descuentos fuera de mandato o compromisos de entrega durante el piloto. Cotización y envío son capacidades distintas; datos públicos no prueban permiso para contactar.

Las verificaciones ejecutables futuras se eligen por riesgo/cambio: contratos, unitarias significativas, integración real con versión/ACL y E2E cuando proceda. No escribir tests espejo solo para cantidad. Una fase documental puede cerrar su evidencia documental sin afirmar que pasó un gate de proveedor. Dependientes de una capacidad no verificada permanecen bloqueados/deshabilitados. Si falta Docker/red/licencia/cuenta, marcar NOT_VERIFIED y explicar, sin usar datos de clientes reales para forzar PASS.

## Reversión y reporte

Deshabilitar capacidad o flag y detener efectos nuevos; conservar audit, links, intents, snapshots y receipts. Restore probado con restricciones/supresiones reaplicadas; no borrar efectos remotos para fingir reversión.

Un timeout posterior a escritura remota deja incertidumbre: consultar estado por referencias verificables antes de reintentar. Fencing local no garantiza exactamente-una-vez remoto. No convertir aprobación de borrador en permiso de firmar, pagar, presentar, contratar o acreditar. Un evento enviado necesita ACK para contar como handoff recibido.

Registrar cambios, supuestos, fuentes/revisión y todo intento de mutación, incluidos fallidos. Separar payload sensible de refs auditables con retención. No tokens/DSN/PII/prompts privados en Git/logs/reportes/eventos. Detener ante fuga, bypass, duplicado, pérdida de audit o falta de sustento de una decisión sensible.

Reportar tras C05/C10/C15/C20/C25/C30/C35/C40/C42: estado PASS/BLOCKED/NOT_VERIFIED, SHA/PR/diff, entorno/versiones, tests realmente ejecutados/pasados/fallidos/skipped, receipts, coste, limitaciones y siguiente gate. La implementación futura no tiene plazo ficticio de siete días.

Fuentes: H01, S01, S02, P01. [Registro](../research/sources.json), [repos/SHAs](../research/repositories.json), [contratos](../contracts/01-contratos.md), [identidad/twins](../architecture/02-identidad-twins.md), [aceptación](../release/PILOT-ACCEPTANCE.md).
