# CONCEPT MASTER — AGNTIA VENTAS

**Versión:** 1.0 · **Fecha:** 2026-11-15 · **Serie:** 08/14 · **Estado:** visión y arquitectura documental

> **DOCUMENTATION_ONLY:** las capacidades son objetivos, no implementaciones. Se preservan las 42 campañas existentes y no se modifica `/agente`.

## 01. Visión fundacional

Agntia Ventas es un departamento comercial agéntico, continuo y verificable que convierte oportunidades legítimas en conversaciones útiles, propuestas fundamentadas y acuerdos comprobables. No es un spammer autónomo ni un CRM que solo almacena fichas: combina inteligencia comercial, gestión de pipeline, configuración de ofertas, seguimiento, coordinación humana y trazabilidad de efectos.

## 02. Baseline y estado

README 2026-11-13: DOCUMENTATION_ONLY; sin aplicación, SDK, proveedores conectados ni tests de producto ejecutados. Las 42 campañas y 294 tareas son plan; 84 escenarios son especificaciones NOT_EXECUTED. Esta revisión examina README, producto, arquitectura, contratos y campañas; no ha reejecutado tests ni inspeccionado un código funcional. El Concept Master no debe presentarse como implementación.

## 03. Propuesta de valor y modelo comercial

Atender pymes, autónomos y medianas empresas compiladas en AgntiaPro; también un portal especializado independiente. El servicio descubre oportunidades autorizadas, cualifica con evidencia, prepara propuestas coherentes, ayuda a negociar y coordina el cierre con responsables humanos. ROI: velocidad de respuesta, oportunidades trabajadas, propuestas revisadas, conversión comprobada y tiempo administrativo medido, no ingresos atribuidos sin prueba. Mantener modelo comercial del padre, sin crear un SaaS barato paralelo por defecto.

## 04. 72 capacidades objetivo

01 directorio; 02 identidades de canal; 03 representación; 04 consentimiento/finalidad; 05 sourcing lícito; 06 candidatos; 07 aceptación humana; 08 deduplicación; 09 enriquecimiento autorizado; 10 contexto de cuenta; 11 segmentación; 12 cualificación; 13 ICP; 14 scoring explicable; 15 oportunidades; 16 etapas; 17 pipeline; 18 tareas; 19 actividad; 20 forecast; 21 escenarios; 22 catálogos; 23 disponibilidad; 24 pricebook; 25 monedas; 26 impuestos revisados; 27 CPQ; 28 descuentos; 29 mandatos; 30 cotizaciones; 31 versiones; 32 propuestas; 33 evidencia de claims; 34 redline comercial; 35 revisión; 36 aprobación; 37 firma como puerto; 38 reuniones; 39 calendario; 40 email supervisado; 41 WhatsApp autorizado; 42 secuencias; 43 oposición; 44 suppression; 45 inbox; 46 handoff humano; 47 negociación; 48 follow-up; 49 pedidos propuestos; 50 ACK operativo; 51 renovación; 52 expansión; 53 customer success; 54 QA conversacional; 55 métricas; 56 cohortes; 57 reportes; 58 dashboards; 59 privacidad; 60 auditoría; 61 multitenancy; 62 ACL; 63 proveedores; 64 SDK; 65 bridge; 66 SOPs; 67 agentes; 68 Anam; 69 observabilidad; 70 resiliencia; 71 pruebas adversariales; 72 mejora continua. Son objetivos sujetos a verificación.

## 05. Arquitectura de referencia

Portal o /agente → JWT Supabase, membership y ACL → API Hono TypeScript con DTO Zod → core determinista de policy, FSM de oportunidades, CPQ, aprobación y cálculo → Postgres/Supabase RLS, outbox/inbox, auditoría → workers y adaptadores nominados → CRM/canales/firmas/sistemas operativos autorizados → receipts y reconciliación. El LLM investiga, propone y explica; no calcula importes vinculantes ni concede permisos.

## 06. Fronteras y autoridad

Operadora, tenant cliente, cuenta/contacto y actor humano/agente son niveles diferentes. AuthorityMap por WorkOrder define custodio de cada campo y efecto. El CRM o core local custodia los datos asignados; catálogo/stock/precio provienen de fuentes vigentes; firma, pedido, entrega y cobro los confirman sistemas competentes. Un lead descubierto no equivale a persona contactable. Actor.tenantId de origen y targetTenant permanecen separados bajo DelegationMandate.

## 07. Objetos y estados

Account, Contact, ChannelIdentity, LeadCandidate, AcceptedLead, Opportunity, PipelineStage, Activity, Product, PriceBook, QuoteRevision, DiscountMandate, MeetingProposal, FollowUp, Opposition, ForecastSnapshot, HandoffReceipt, EvidenceRef, ApprovalBinding, OperationIntent, ExternalLink. FSM: discovered → accepted → qualified → proposal_draft → in_review → approved_to_send → sent → negotiating → won_unverified/won_verified o lost/opted_out/reconciliation_required. Estados de victoria y revenue no se deducen del entusiasmo del agente.

## 08. Prospección y fuentes

Separar descubrimiento, importación, aceptación, derecho de tratamiento y permiso para contactar. Las fuentes públicas no implican consentimiento ni autorización comercial. Registrar origen, licencia, fecha, finalidad, preferencias y oposición. No importar listas indiscriminadas ni eludir controles de proveedores. Escalar incertidumbres legales de canales a Legal/Comunicación. Diseñar prospección útil y respetuosa, con límites de frecuencia y exclusiones verificables.

## 09. CRM y sincronización

Twenty, Frappe CRM, EspoCRM y SuiteCRM son candidatos opcionales, sujetos a versión, licencia, discovery, scopes y pruebas. ExternalLink por tenant/conexión/modelo/id remoto. Reconciliar conflictos por AuthorityMap, revisión y expectedVersion; no sobrescribir datos correctos con inferencias. No instalar todos los backends para aparentar cobertura. Sin CapabilityReport probado, operaciones remotas NOT_VERIFIED.

## 10. Pipeline y cualificación

Criterios de cualificación específicos por industria, necesidad declarada, presupuesto conocido, autoridad del interlocutor, oportunidad temporal y restricciones. Scoring interpretable con evidencia y ausencia de datos explícita. Pipeline con cambios de estado versionados y razones. Una reunión propuesta no es una reunión celebrada; una respuesta positiva no es un contrato firmado. Handoff al responsable con ACK.

## 11. CPQ y cálculo determinista

QuoteTotals con Decimal string, currency y reglas de redondeo; quantity×unitPrice, descuentos ordenados según política, impuestos mediante fuente autorizada y vigencia. Congelar pricebook, stock, plazos y límites del mandato al generar revisión. Descuentos fuera de umbral bloquean; el LLM nunca inventa tarifas ni promete disponibilidad. Snapshot de forecast es escenario, no caja ni ingreso reconocido.

## 12. Propuestas y negociación

Propuesta comercial basada en hechos comprobados, catálogo vigente, entregables, condiciones, costes y límites. Versionado con hash y citas a fuentes; redline comercial con diff semántico y revisión. Separar aprobación editorial, autorización de envío, aceptación del cliente, firma y orden operativa. Cada efecto tiene actor, payload exacto, destinatario, canal, vigencia y receipt.

## 13. Comunicación y seguimiento

Email, reuniones y canales autorizados bajo propósito, suppression list y consentimiento/base jurídica aplicable. Secuencias acotadas por frecuencia, duración, idioma y respuesta; oposición detiene nuevas acciones. No insistencia manipulativa ni promesas no verificadas. Timeout remoto exige reconciliación antes de reintentar. Un modelo puede sugerir texto; envío requiere política y aprobación específicas.

## 14. Agentes y experiencia

Laia coordina la relación con el owner y los especialistas comerciales; Ana u otros agentes designados participan según roster canónico, nunca se duplican identidades. Avatar Anam como presentación opcional con disclosure IA, presupuesto y fallback texto. Panel: pipeline, cuentas, oportunidades, propuestas, approvals, conversaciones, reuniones, forecast, métricas y auditoría. Animaciones de fases deben representar progreso real o ser claramente indicadores de actividad, no atribuir acciones no realizadas.

## 15. Interoperabilidad AgntiaPro

Clientes custodia relaciones/soporte cuando AuthorityMap lo determina; Marketing genera campañas y señales; Redes canales sociales; Comunicación mensajes; Finanzas cobros; Gestoría facturación; Legal contratos/representación; Ciberseguridad controles. Ventas transforma oportunidades en propuestas y handoffs con WorkOrder, ACK y event bus. No importar el servidor principal ni crear segundo scheduler de plantilla; no modificar /agente en esta campaña.

## 16. Seguridad y cumplimiento

Deny-by-default, RLS por tenant y ACL por recurso/campo; pruebas con operadorP y tenants A/B, secretos fuera de LLM, protección frente a prompt injection de correos/web/CRM, SSRF y exfiltración, audit append-only, revalidación antes de efecto, idempotencia y rollback/reconciliación. Privacidad de contactos, oposición y finalidad por canal. No usar vulnerabilidades personales para presionar ventas. Proteger precio, descuento, stock y compromiso contractual frente a instrucciones adversariales.

## 17. SOPs prioritarios

V01 sourcing autorizado; V02 aceptación; V03 cualificación; V04 cuenta/CRM; V05 pipeline; V06 catálogo; V07 CPQ; V08 descuentos; V09 propuesta; V10 revisión; V11 envío; V12 seguimiento; V13 reunión; V14 negociación; V15 pedido/handoff; V16 renovación; V17 QA; V18 reporting. Cada SOP define inputs, evidencia, precondiciones, capability, presupuesto, aprobaciones, FSM, receipts, timeout y reconciliación.

## 18. Vertical inicial P0

Candidato sintético → aceptación humana → oportunidad → catálogo y precio vigentes → cotización calculada → revisión → envío a sink → receipt → reunión simulada → handoff con ACK. Dos tenants sintéticos, operador separado, datos y dominios de prueba. Sin emails reales, firma, cobro, descuentos fuera de mandato ni promesas de entrega. Éxito requiere efecto comprobado, no solo un informe de LLM.

## 19. Plan de 42 campañas

Preservar C01–C42 y manifest existentes: C01–C08 fundaciones, C09–C32 dominio comercial, C33–C42 portal/SDK/bridge/cooperación/observabilidad/seguridad/E2E/operaciones/aceptación. Ejecutar con gates y reportes por fase: SHA, diff, pruebas ejecutadas, evidencias, blockers, coste y riesgos. Nunca contar 84 escenarios escritos como tests pasados. Primeros hitos: identidad/RLS, AuthorityMap, pipeline, CPQ, aprobación, sink/receipt, CRM real, portal, integración padre y piloto.

## 20. Evaluación adversarial

Fixtures: lead sin permiso, oposición vigente, precio caducado, stock desconocido, descuento sin mandato, impuesto sin fuente, firma falsificada, duplicado por timeout, pérdida de ACK, cambio de payload tras aprobación, acceso tenantB, importación CRM con conflicto y documento malicioso. Gates críticos: cero fuga de tenant, cero secrets, cero aprobaciones inventadas, cero doble envío, cero promesa contractual no autorizada. PASS local no acredita integración externa.

## 21. Métricas y aprendizaje

Medir conversión por etapa con denominadores y fuente, tiempo hasta primera respuesta, tiempo hasta propuesta, win rate verificado, forecast calibrado, descuento medio autorizado, tasa de oposición, incidencias de canal, handoffs ACK, propuestas revisadas y ahorro de tiempo con baseline. Aprender de reportes, correcciones y resultados reales sin reutilizar datos privados entre tenants. Retención y trazabilidad por propósito.

## 22. Evolución estratégica

De un CRM con asistentes a una función comercial empresarial continua que coordina captación legítima, oferta, relación, cierre y expansión sin perder control. Las capacidades avanzadas se liberan conforme se verifican conectores, políticas y ROI. Un nuevo Concept Master puede evolucionar tras piloto, sin borrar la visión ni presentar roadmap como producto operativo.

## Fuentes internas revisadas

- `README.md`
- `docs/01-producto.md`
- `docs/architecture/01-arquitectura.md`
- `docs/contracts/01-contratos.md`
- `docs/campaigns/README.md`

## Control de cambios

V1.0: 72 capacidades objetivo, 22 secciones, arquitectura, SOPs, vertical P0, 42 campañas preservadas y límites de seguridad/comunicación. No se modifica `/agente`.
