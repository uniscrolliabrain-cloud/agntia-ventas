# Autoridad y cooperación entre Ventas y repos hermanos

## Padre
AgntiaPro es autoridad de kernel, identidad, memoria, bus, SOP, policy y aprobaciones. Ventas es especialista delegado. Un efecto de enviar/cobrar/reservar tiene un executor designado por AuthorityMap y scope.

## Fronteras
Marketing crea demanda, campañas y candidatos; Ventas acepta leads, cualifica, gestiona oportunidades y negocia. Redes gestiona publicación/comunidad; Ventas no publica desde ambos a la vez. Clientes es CRM/servicio/posventa compartido; fuente de verdad de contacto definida por tenant. Finanzas ve previsiones, liquidaciones y tesorería, no duplica cobros. Gestoría emite factura oficial; Legal revisa términos/consentimientos/contratos. Branding define identidad de marca; Formación capacita equipo; Ciberseguridad audita sin acceso ilimitado a conversaciones.

## Puertos conceptuales
LeadSourcePort, ContactPermissionPort, CRMPort, PipelinePort, CalendarPort, MessagingPort, CPQPort, ProposalPort, SignaturePort (DISABLED inicialmente), CheckoutPort (DISABLED inicialmente), SettlementReadPort, AuditEvidencePort. Adaptadores posibles Google Calendar/Gmail, Meta/WhatsApp, LinkedIn, Stripe, HubSpot, Pipedrive, Airtable, CRM cliente y MCP; no se presume que existan o tengan permisos.

## Adapter contract
provider, tenantBinding, accountBinding, authScopes, lawfulBasis/purpose, suppression, capability, sourceOfTruth, schemaVersion, rateLimit, budget, timeout, retries, idempotency, receipts, reconciliation, audit, dataResidency, retention. MCP no evita policy ni permisos.
