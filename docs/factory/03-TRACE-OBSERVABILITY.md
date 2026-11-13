# ADTC — Ventas, trazabilidad distribuida y observabilidad

**Propuesta conceptual v0.1, no API implementada.** Padre controla bus/grafo; Ciberseguridad observa correlaciones multi-repo sin acceso universal a PII o CRM.

## Envelope lógico propuesto
```json
{"schemaVersion":"adtc/0.1","eventId":"unique-event","eventType":"ventas.proposal.prepared","tenantId":"verified-tenant","actorId":"verified-actor","taskId":"task-ref","correlationId":"stable-commercial-workflow","causationId":"parent-event-ref","requestId":"ingress-ref","traceId":"w3c-trace-id","spanId":"current-span-id","idempotencyKey":"effect-specific-key","source":"agntia-ventas","resourceRefs":["opportunity-ref","proposal-version-ref"],"evidenceRefs":["approval-ref"],"payloadRef":"restricted-ref"}
```
Bridge versionado con SystemEvent real; no añadir enums al padre por conjetura.

## Propagación y garantías
Mantener tenant, actor, mandato, correlationId, causationId y provenance entre Marketing→Ventas→Clientes→Finanzas/Gestoría. EventId nuevo por evento; attemptId por intento; idempotencyKey estable por efecto. Outbox/inbox dedupe, retry budget, DLQ, receipt y outcome_unknown; reconciliar antes de reenviar un mensaje o repetir cobro. La traza técnica puede muestrearse; efectos comerciales, approvals y recibos durables no.

## Seguridad
No incluir emails, teléfonos, mensajes privados, tokens, propuestas completas, datos bancarios ni CRM en bus/OTel. Refs con ACL, finalidad, cifrado y retención. Suppression por tenant, canal, destinatario y política aplicable. No permitir que tenant B descubra pipeline A por logs, búsquedas, errores o métricas.

## Ejemplo
Marketing identifica candidato → padre registra task → Ventas verifica procedencia y base de contacto → humano aprueba secuencia → adaptador autorizado envía con idempotencia → reply/meeting → propuesta versionada → aprobación → pedido/Stripe en adaptador autorizado → Finanzas observa settlement → Gestoría factura → Ciberseguridad reconstruye causalidad sin contenido privado.

## Negativos
Un opt-out bloquea siguientes envíos; timeout no duplica contacto/cobro; replays no publican; propuesta modificada invalida approval; no atribuir cobro por webhook no verificado.
