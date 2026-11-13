# Contratos de diseño v1

Propuesta, no API/SDK existente. TypeScript+validación runtime/JSON Schema, extra fields rechazados, límites de tamaño, IDs opacos y enums cerrados. Dinero Decimal string/currency/exponente, fechas ISO con offset y timezone separada. No forzar UUID a IDs del padre o usar float para compromisos monetarios. schemaVersion del servicio es distinto del SystemEvent nativo string1.0.

## Envelope propuesto

```json
{"schemaVersion":1,"operationId":"opaque","tenantId":"server-resolved","actorId":"server-verified","capability":"ventas.proposal.preview","requestId":"host-if-present","correlationId":"trace","causationId":null,"idempotencyKey":"domain-key","expectedVersion":3,"approvalRef":null,"dryRun":true,"payload":{"resourceId":"opaque"}}
```

Identity/capability del JSON no son prueba; principal/policy las derivan/verifican. Envelope.tenantId es scope de datos, no sustitución del Actor de origen al delegar. Worker con identidad de servicio y DelegationMandate: originatingActor/tenant, targetTenant, WorkOrder/TwinBinding, recursos/campos/capabilities/purpose, budget, issued/expires/revocationVersion/proof. Sin membership implícita o redelegación ampliada.

## Entidades y datos específicos

| Módulo | Campos/refs propuestos | Capacidad nominada interna/propuesta |
|---|---|---|
| Directorio y representación | accountId, contactId, organizationRole, channelIdentity, validity | sales.contacts.preview |
| Candidatos y aceptación | sourceCredit, candidateRef, discoveredAt, acceptedBy | sales.candidates.accept |
| Pipeline y etapas | opportunityId, stageVersion, expectedVersion, reasonCode | sales.pipeline.transition |
| Triage y cualificación | qualificationFacts, missing, confidence, sourceRefs | sales.qualification.propose |
| Fuentes y contexto de cuenta | accountSnapshot, rightsRef, sourceHash, fieldACL | sales.account.context |
| Adaptador CRM Twenty | workspaceBinding, schemaHash, roleRef, remoteVersion | sales.twenty.preview |
| Adaptadores Frappe/Espo/Suite | siteBinding, modelAllowlist, capabilityReport, mapperVersion | sales.crm.import |
| Import y conflictos | externalLink, cursor, contentHash, reviewedVersion | sales.import.preview |
| Catálogo y disponibilidad | productRef, catalogVersion, currency, stockAt, validUntil | sales.catalog.read |
| Pricebook y tarifas | priceBookId, version, unitPrice, effectiveFrom, currency | sales.price.preview |
| CPQ y redondeo | quoteLines, DecimalAmounts, discountScope, roundingPolicy | sales.quote.calculate |
| Mandatos de descuento | discountMandate, approver, maxRate, expiresAt, scope | sales.discount.propose |
| Propuesta y versiones | quoteRevision, claims, evidenceRefs, proposalHash | sales.quote.propose |
| Firma electrónica como puerto | envelopeProposal, signerRole, representationProof, signatureStatus | sales.signature.propose |
| Reuniones y calendario | meetingProposal, timezone, attendees, calendarBinding | sales.meeting.preview |
| Correo comercial supervisado | recipientScope, purpose, suppressionVersion, contentHash | sales.email.preview |
| Secuencias y oposición | sequenceVersion, stepId, maxSteps, oppositionRef | sales.followup.propose |
| Inbox y toma humana | threadRef, internalNote, handoffState, ownerRef | sales.handoff.preview |
| Actividad y receipts | activityId, actorRef, providerReceipt, occurredAt | sales.activity.log |
| Forecast y escenarios | forecastDefinition, cohort, probabilityVersion, coverage | sales.forecast.run |
| Pedido y handoff operativo | acceptedQuote, orderProposal, receiverScope, ackRef | sales.order.propose |
| Renovación y expansión | contractDateRef, followupPurpose, entitlementRef, changeProposal | sales.renewal.propose |
| QA de conversación comercial | trajectory, unsupportedClaims, policyViolations, reviewRef | sales.quality.evaluate |
| Métricas comerciales y cohortes | wonEvidence, recognizedRevenueRef, collectedRef, window | sales.metrics.snapshot |

Estas entidades no son aliases automáticos de modelos del proveedor/padre. Tipos públicos contienen refs mínimos/estado/frescura; secretos y documentos restringidos se custodian por backend con permiso. Estado desconocido, dato no verificado, bloqueado y no soportado son valores explícitos, nunca null ambiguo rellenado por LLM.

## DTOs transversales

EvidenceRef: id, tenantId/resourceScope, originalCustodian, sourceObjectRef/hash, mapperVersion, observed/effectiveAt, kind fact/inference/user_assertion/observation y reviewRef. Cuando proyecte provenance nativa, preservar source/actor/updatedAt/confidence? sin convertir confianza en permiso. ExternalLink: tenant/connection/provider/model/externalId string/localKind/localId, remoteVersion, sourceHash y lastSeenAt.

ProposalRevision: resource/version, structuredInputs, artifacts, sources, pendingFacts, scopeHash, modelConfigRef, policyVersion y warnings. ApprovalBinding: principal/reviewer competente según caso, proofRef, payloadHash/resourceVersion/rightsHash/policyHash, tenant/recipient/channel/costCeiling/expiry/revocation. OperationResult discriminado: status/localRefs/remoteRefs/evidenceRefs/payloadHash/warnings/retryable/reconciliationRequired/actualScope. Nunca payload remoto sensible completo.

CapabilityReport: deployment/edition/version, operaciones/campos/ACL confirmados, timestamp/expiry/errors y evidence. SyncJob/Cursor/Conflict/ReportSnapshot: ámbito tenant/recurso, estado/versión/correlación/sourceWatermark/coverage/hash y resolución revisable. Índices únicos por tenant/capability/key, tenant/connection/model/externalId/localKind y tenant/connection/externalEventId; FK compuestas por tenant para cardinalidades explícitas.

## API nominada prevista

Prefijo `/v1/ventas`. GET /me, /resources, /resources/{id}, /integrations/{id}/capabilities, /jobs/{id}, /conflicts y /reports/{id}. POST /imports/preview y /imports; /proposals y /proposals/{id}/preview; /intents; /intents/{id}/reconcile; /reports; /advisor-sessions y /advisor-sessions/{id}/close; /privacy-requests. Acciones específicas anteriores se materializan solo si son capacidades de producto autorizadas, no baseline/admin endpoints por defecto.

Lecturas con fields/filters allowlist, paginación y ACL antes de acceso. Commits con key/expectedVersion/approval según riesgo y revalidación. Trabajo largo202+jobId scoped. Dry-run no muta; test endpoint remoto puede tener efecto y requiere su propia autorización. No /provider/{method}, SQL libre, HTTP/ORM/model/domain de búsqueda arbitrario o /execute-anything.

Errores400/422 input/negocio;401auth;403capacidad;404recurso ajeno/inexistente;409versión/key/conflicto;424dependencia si se adopta;429límite;502respuesta inválida;503proveedor;504timeout. Envelope code/message/correlationId/retryable/reconciliationRequired sin traceback/PII/secretos. Resultado incierto no es failed seguro para retry.

## Tools, eventos y compatibilidad

Tools propuestas: `sales_pipeline_read sales_account_read sales_candidate_preview sales_quote_propose sales_followup_propose sales_forecast_explain sales_handoff_propose`. Tenant/actor/scopes no son input libre del modelo. Approve/send/export_all/admin y efectos sensibles fuera del catálogo inicial. SDK servidor privado y proxy Hono con allowlist exacta de ruta/método/tamaño; MCP/Anam usan mismo PEP. No anunciar paquete npm/pip publicado por este documento.

Eventos nuevos `ventas.proposal.created`, `.review.required`, `.resource.changed`, `.operation.confirmed`, `.operation.outcome_unknown`, `.connection.degraded` con id/schemaVersion/tenant/actorRef/occurredAt/correlation/causation y refs mínimas. No enum host inventado; bridge mapea hechos confirmados al SystemEvent nativo con owner/emittedAt/source permitido. Outbox/inbox/receipt dan entrega at-least-once y ACK posterior al commit, no garantía de exactly-once HTTP.
