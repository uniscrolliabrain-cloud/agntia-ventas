# Padre observado y mapeo de contratos

Referencia `54b8d5407a8576459448c4d059a877297d18ca7a`, main cotejado 2026-11-13. [Mapa por archivo/blob](../research/parent-source-map.json). Incluye lecturas selectivas heredadas y seis nuevas lecturas; no auditoría exhaustiva, ejecución de su suite o modificación del padre. Los símbolos comentados como pendientes no se presumen desplegados.

| Fuente nativa | Observación | Implicación |
|---|---|---|
| actor.ts y jwt.ts/auth | Actor, runtime/persona/rol, claims Supabase y resolución | Conservar nombres, no aceptar JSON del LLM como principal |
| tenant-principal/scope/db-tenant | Contexto scoped y compatibilidad legacy | No copiar fallbacks como permiso del nuevo servicio |
| business.ts | provenance source/actor/updatedAt/confidence?, schemaVersion/version | Preservar fuente/revisión; confidence no es prueba |
| agent.ts | assignedBy/assignedTo, requestId, evidence/artifactIds/outcome | Delegante y ejecutor separados, trazabilidad a tareas |
| capability.ts | risk, sideEffects, permissions, requiresApproval, idempotency/retryable | La declaración/default no demuestra garantía del backend; verificar cada operación |
| outcome.ts | achieved/partial/blocked/failed/unknown y Evidence.kind | Unverified por defecto no se cambia a true porque el modelo lo diga |
| verification.ts | método deterministic/llm/hybrid/manual y criterios | Verificación lingüística no sustituye autorización o competencia profesional |
| business-schema.ts | Esquema v2; comentario sobre estados/relaciones aún no persistidos en instalador | No prometer soporte automático de todos estados propuestos |
| form-spec.ts | Campos y chips de procedencia | Chip visual no autoriza lectura ni confirma validez del dato |
| learning.ts | Aprendizaje procedural de agentes scoped y estado proposed/approved/active | No equivale perfil de alumno/diagnóstico ni autoactivación de SOP |
| events/types.ts | SystemEvent schemaVersion string1.0, emittedAt, owner y source permitido | Nuevos eventos del servicio requieren mapping, no cambiar enum padre |
| leads/canales/analytics | Descubrimiento no acepta lead; clientes reales de correo/WhatsApp y resultados inciertos; overview de datos | No duplicar envío ni extender conclusiones a ámbitos no implementados |

## Mapeos de este dominio

El CRM elegido o el core local custodia cada campo por AuthorityMap; precio/stock/plazo proceden de fuentes verificadas; firma y caja confirman hechos externos, no el chat. Los objetos `Account Contact ChannelIdentity LeadCandidate AcceptedLead Opportunity PipelineStage Activity Product PriceBook QuoteRevision DiscountMandate MeetingProposal FollowUp Opposition ForecastSnapshot HandoffReceipt` son propuesta del servicio. Mapear a BusinessEntity o recursos específicos solo cuando se compruebe semántica y autoridad; no meter un objeto completo en properties y asumir autorización. `owner`, `tenantId`, `sub` y actorId no son sinónimos; el bridge los resuelve por contrato de servidor. requestId/correlationId/causationId conservan su función y enlaces.

Provenance nativa se complementa con sourceObjectRef/sourceHash, mapperVersion, effectiveAt/observedAt, evidenceRefs, revisión y resultado. Nuevos campos se declaran nuevos. Una afirmación de usuario o inferencia del modelo no se etiqueta fact/verified automáticamente. Si cambia original/fuente/mandato, marcar proyección stale o conflicto antes de efecto.

## Eventos

Los eventos `ventas.*` propuestos son de este middleware, no enum vigente del padre. El bridge puede proyectar hechos confirmados a tipos existentes apropiados con id, schemaVersion:"1.0", tenantId, owner, emittedAt, source.kind/id/personaId? y type permitido. No inventar kind ni notificar éxito/actividad hecha sin receipt/evidencia. Dedup durable por domainEventId y ACK después del commit receptor; no exactamente-una-vez HTTP.

## Puertos y prohibición de cambios

Identidad/delegación, approvals, budget, tasks/events y organización son puertos a integrar por contrato probado. Esta entrega solo diseña SDK/Hono/tools/patch propuesto. No editar claims/enums/rutas/configuración ni instalar paquetes en agente. Si el host no ofrece un puerto necesario, registrar HOST_BRIDGE_NOT_VERIFIED y usar fake fiel claramente marcado, sin fabricar aprobación/runtime paralelo. Una futura modificación necesita autorización separada.
