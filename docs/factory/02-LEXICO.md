# Léxico canónico y comercial — v0.1 conceptual

## Identidad y causalidad
tenantId empresa verificada; actorId identidad; leadId/prospectId/customerId no son usuarios autenticados. Agentes canónicos del padre, twins delegados. Task ≠ SOP ≠ Action ≠ Approval ≠ Event. correlationId cadena negocio; causationId evento padre; eventId evento único; traceId/spanId telemetría; requestId entrada; idempotencyKey efecto. TwinBinding, DelegationMandate, AuthorityMap propuestos, no APIs confirmadas.

## Ventas (PROPOSED)
LeadCandidate = candidato sin aceptación ni permiso implícito; AcceptedLead = candidato incorporado con origen/estado; ContactPermission = base/consentimiento y finalidad por canal, sujeto a oposición; SuppressionEntry = no contactar; Account = empresa/cliente comercial, distinta de tenant; Contact = persona de relación comercial; Opportunity = posibilidad con stage, owner y evidencia; PipelineStage = estado de proceso; Activity = acción planificada/realizada; Meeting = evento de calendario confirmado; CatalogItem = producto/servicio versionado; PriceBook = precio vigente; Quote/Proposal = oferta propuesta, no contrato; CPQResult = cálculo determinista; Approval = permiso para efecto concreto; Order = pedido aceptado; PaymentIntent = intención de cobro, no dinero liquidado; PaymentReceipt = recibo del proveedor; Forecast = estimación, no ingreso contabilizado; Handoff = entrega confirmada a operación.

## Distinciones
leadDiscovered ≠ leadAccepted ≠ outreachAuthorized; emailDrafted ≠ emailSent ≠ emailDelivered; meetingSuggested ≠ meetingBooked; proposalPrepared ≠ proposalApproved ≠ contractSigned; paymentLinkCreated ≠ paymentSettled; dealWon ≠ revenueRecognized. Money Decimal string + ISO currency, IVA/FX/rounding versionados; tasa de conversión y forecast con denominador, ventana y origen. No inferir consentimiento de una ficha pública.
