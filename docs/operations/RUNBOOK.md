# Runbook diseñado

Estado NOT_IMPLEMENTED/NOT_EXECUTED. Requiere comandos concretos, responsables, versión y evidencias durante la implementación. No operar datos/servicios reales desde esta entrega documental.

## Arranque de laboratorio

Staging aislado A/B/P; Supabase con issuer/audience/JWKS y memberships/ACL provisionados; Postgres roles/RLS y secretos externos revisados. Backends/versiones/licencias permitidos, cuentas bot mínimas y endpointRef/egress. Writes sensibles, producción, envíos/destinatarios reales y compras off. Discovery semántico y TwinBinding/mandato verificados. Si falta host real, HOST_BRIDGE_NOT_VERIFIED; no editar agente para ocultarlo.

Ejecutar migraciones y reset de fixtures; backup/restore antes de workers. CapabilityReport fresco por operación/edición/rol y campos confirmados. Unknown deshabilitado. Estado histórico y fuentes pueden leerse con freshness visible; no resultados sintéticos presentados reales. Inventariar cron/plugins/side effects y no activar automáticamente workflows remotos al importar datos.

## Degradación y reconciliación

Clasificar error y alcance tenant/conexión/capacidad. Detener nuevos efectos que no puedan autorizarse, preservar intent/audit/receipt/correlación. Lecturas con backoff finito; tras escritura posible y timeout consultar referencias remotas o bloquear/escalar. No retry con nueva key o segundo proveedor. Cancel local o flag no garantiza que el proveedor deshizo un efecto aceptado.

Recuperar lease requiere fencing y revalidación de actor/mandato/approval/version/fuente/restricciones/purpose/budget. Worker viejo no hace ACK. DLQ con causa/operación y decisión humana cuando incierta; no borrar cola para fingir éxito. Cursor avanza tras commit. Handoff sin ACK no es trabajo completado; no generar briefing de actividad imaginaria.

## Dominio

Sin mensajes comerciales reales, alta automática de leads por scraping, firma/contrato, cobro, descuentos fuera de mandato o compromisos de entrega durante el piloto. Cotización y envío son capacidades distintas; datos públicos no prueban permiso para contactar.

Señal crítica: Un descuento prometido por el modelo supera el mandato o se manda un seguimiento tras oposición. Conservar evidencia minimizada, detener la capacidad afectada y remitir a responsable competente. El CRM elegido o el core local custodia cada campo por AuthorityMap; precio/stock/plazo proceden de fuentes verificadas; firma y caja confirman hechos externos, no el chat. Una modificación de fuente puede invalidar conclusión/approval; crear revisión/stale/conflicto, no overwrite del pasado. Restablecer control no equivale a certificar legalidad o calidad universal.

## Acceso e incidente

Rotar JWT/JWKS/OAuth/API keys con prueba de caché/revocación y cambios de rol. Mandatos/memberships suspendidos afectan jobs/sesiones/contexto. Soporte excepcional con motivo/alcance/tiempo/audit; sin owner global implícito. Ante fuga/secretos/bypass/doble efecto, cortar conexiones/capacidades, preservar historia y evaluar hechos/obligaciones con humanos responsables. No guardar PII completa innecesariamente o publicar logs de clientes.

## Backup y release

Backups cifrados/retención/keys separados y prueba aislada de restore; comparar objetos/versiones/links/audit/cursores/intents/receipts/índices y reaplicar restricciones posteriores al backup. No reactivar mandatos caducados o efectos ya confirmados. Migraciones aditivas compatibles y plan explícito si rollback de estructura no es seguro. Flag detiene efectos, no borra originales o registros externos para simular reversión.

Release candidata de policy/prompt/modelo/playbook/plantilla/curso pasa evaluaciones/no regresión y revisión humana; canario por tenant/alcance, rollback y métricas. Al cambiar materialidad se invalidan approvals aplicables. Alertas calibradas de lag/unknown/conflictos/coste/freshness, p50/p95 medidos. Rota de empresa en padre. Producción/wiring/servicios pagados requieren un encargo separado y resultado revisable antes de autorización.
