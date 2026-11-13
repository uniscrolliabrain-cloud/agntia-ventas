# Producto, capacidades y límites

## Resultado para el cliente

Convertir oportunidades autorizadas en trabajo comercial verificable: CRM, pipeline, reuniones, propuestas y seguimiento, sin convertir presión por vender en permisos de efecto. El cliente contrata una especialidad con entregables revisables, no una simulación de personas trabajando. El avatar explica datos, fuentes, límites y bloqueos; el owner puede editar propuestas y aprobar el resultado concreto. Humanos y agentes generalistas usan el mismo servicio bajo permisos. Un cliente externo tiene portal propio y Supabase; no debe entrar en AgntiaPro o paneles ERP/LMS/CRM para obtener valor.

| Pilar | Valor previsto | Prueba exigida |
|---|---|---|
| Directorio y relación comercial con origen/representación | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| Captación consentida y aceptación de candidatos | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| Pipeline, forecast y actividad con estados auditables | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| Catálogo, precios, propuestas y CPQ determinista | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| Reuniones, seguimiento e inbox con supresión | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| Aprobación contractual, firma como puerto y handoff a operación | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |

Estas capacidades son diseño, no features implementadas. Las 24 fases de dominio detallan objetos, invariantes y escenarios; se complementan con ocho fundaciones y diez fases de exposición/seguridad/operaciones hasta completar42. No instalar todos los backends para aparentar cobertura. Elegir un camino P0 funcional, conservar capacidades opcionales deshabilitadas hasta prueba real.

## Actores y datos

Organización operadora emplea al agente canónico del padre; tenant representa empresa cliente del SaaS; proyectos/materias/cohortes/cuentas son recursos internos; personas registradas en datos no se convierten en usuarios autorizados por importarlas. Usuario válido no ve todo el tenant: ACL por recurso/campo, representación y propósito cuando corresponde. Un mismo humano puede trabajar en varios tenants y debe seleccionar ámbito verificado explícitamente.

Entidades propuestas: `Account Contact ChannelIdentity LeadCandidate AcceptedLead Opportunity PipelineStage Activity Product PriceBook QuoteRevision DiscountMandate MeetingProposal FollowUp Opposition ForecastSnapshot HandoffReceipt`. Sus IDs son del servicio salvo mapeo nativo declarado. El CRM elegido o el core local custodia cada campo por AuthorityMap; precio/stock/plazo proceden de fuentes verificadas; firma y caja confirman hechos externos, no el chat. La fuente remota y el snapshot local tienen autoridad/frescura distintas. El modelo no rellena campos desconocidos para completar una pantalla; faltan datos significa pending/blocked, no falso éxito.

## Vertical inicial

Candidato sintético → aceptación humana → oportunidad → catálogo/precio vigente → quote calculada → revisión → envío a sink → receipt → reunión simulada → handoff con ACK.

Usar empresas/personas/documentos sintéticos y sink/entorno de prueba, con dos tenants y operador separado. Un borrador no es acto externo ni una certificación. Cualquier conector que falte se indica NOT_VERIFIED, sin presentar mock como instalación real. El piloto puede entregar conocimiento y propuesta útil aunque un efecto sensible quede deliberadamente fuera.

## Límites de efecto

Sin mensajes comerciales reales, alta automática de leads por scraping, firma/contrato, cobro, descuentos fuera de mandato o compromisos de entrega durante el piloto. Cotización y envío son capacidades distintas; datos públicos no prueban permiso para contactar.

La presión comercial no permite engaño, insistencia tras oposición, promesas no soportadas ni selección de personas por vulnerabilidades. Las revisiones son actos humanos verificables ligados al payload y versión. No las fabrica un nombre de agente, un sí hablado o un campo approved=true. La aceptación comercial del servicio, el acceso a datos, la revisión editorial y la autorización de efecto son hechos distintos.

## Cooperación y evolución

Se admite duplicación funcional entre los nueve SaaS y el padre. ServiceAgreement/WorkOrder fija alcance, responsable y sistema ejecutor por efecto. Un módulo local acotado puede cubrir una función sin contratar un hermano, pero no inventa autorización profesional, saldo, dictamen o evidencia. Integrar no significa compartir todos los datos: contratos mínimos, propósito, ACK y trazabilidad.

La expansión exige nuevos permisos, pruebas y contratos cuando se habiliten datos reales, proveedores pagados o funciones reguladas. La campaña no garantiza paridad con líderes, precisión universal o disponibilidad jurídica de cada función. Producto completo significa capacidades verificadas en ámbito concreto con operación/recuperación y límites visibles, no una lista de logos.
