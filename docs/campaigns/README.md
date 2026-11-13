# Campaña de42 fases

Diseño para una implementación futura autorizada. **42 campañas,294 tareas,84 escenarios, NOT_STARTED/NOT_EXECUTED.** No plazo ficticio de siete días. No modificar agente. Fuentes/contratos no equivalen a capacidades probadas.

[Manifest estructurado](campaign.json): IDs/dependencias, campos, operaciones, invariantes, tareas/aceptación, gates, bloqueos y rollback. Rutas de artefactos son propuestas, no archivos existentes.

C01–C08 fundaciones; C09–C32 dominio; C33–C42 exposición/servicio/seguridad/operaciones/aceptación. Avance por gates con capacidades no verificadas deshabilitadas; un fake no pasa gate real. Checkpoints cada 5 y al final de 2.

| Fase | Documento | Estado | Checkpoint |
|---|---|---|---|
| 01 | [Baseline, fuentes y alcance](01-baseline-fuentes-y-alcance.md) | NOT_STARTED | — |
| 02 | [Autoridad por dominio y contrato SaaS](02-autoridad-por-dominio-y-contrato-saas.md) | NOT_STARTED | — |
| 03 | [Supabase JWT y principal](03-supabase-jwt-y-principal.md) | NOT_STARTED | — |
| 04 | [Twins y nomenclatura canónica](04-twins-y-nomenclatura-canonica.md) | NOT_STARTED | — |
| 05 | [DTOs, esquemas y errores](05-dtos-esquemas-y-errores.md) | NOT_STARTED | Informe |
| 06 | [Persistencia, RLS y migraciones](06-persistencia-rls-y-migraciones.md) | NOT_STARTED | — |
| 07 | [Mandatos, finalidad y aprobaciones](07-mandatos-finalidad-y-aprobaciones.md) | NOT_STARTED | — |
| 08 | [Secretos, discovery y aislamiento remoto](08-secretos-discovery-y-aislamiento-remoto.md) | NOT_STARTED | — |
| 09 | [Directorio y representación](09-directorio-y-representacion.md) | NOT_STARTED | — |
| 10 | [Candidatos y aceptación](10-candidatos-y-aceptacion.md) | NOT_STARTED | Informe |
| 11 | [Pipeline y etapas](11-pipeline-y-etapas.md) | NOT_STARTED | — |
| 12 | [Triage y cualificación](12-triage-y-cualificacion.md) | NOT_STARTED | — |
| 13 | [Fuentes y contexto de cuenta](13-fuentes-y-contexto-de-cuenta.md) | NOT_STARTED | — |
| 14 | [Adaptador CRM Twenty](14-adaptador-crm-twenty.md) | NOT_STARTED | — |
| 15 | [Adaptadores Frappe/Espo/Suite](15-adaptadores-frappe-espo-suite.md) | NOT_STARTED | Informe |
| 16 | [Import y conflictos](16-import-y-conflictos.md) | NOT_STARTED | — |
| 17 | [Catálogo y disponibilidad](17-catalogo-y-disponibilidad.md) | NOT_STARTED | — |
| 18 | [Pricebook y tarifas](18-pricebook-y-tarifas.md) | NOT_STARTED | — |
| 19 | [CPQ y redondeo](19-cpq-y-redondeo.md) | NOT_STARTED | — |
| 20 | [Mandatos de descuento](20-mandatos-de-descuento.md) | NOT_STARTED | Informe |
| 21 | [Propuesta y versiones](21-propuesta-y-versiones.md) | NOT_STARTED | — |
| 22 | [Firma electrónica como puerto](22-firma-electronica-como-puerto.md) | NOT_STARTED | — |
| 23 | [Reuniones y calendario](23-reuniones-y-calendario.md) | NOT_STARTED | — |
| 24 | [Correo comercial supervisado](24-correo-comercial-supervisado.md) | NOT_STARTED | — |
| 25 | [Secuencias y oposición](25-secuencias-y-oposicion.md) | NOT_STARTED | Informe |
| 26 | [Inbox y toma humana](26-inbox-y-toma-humana.md) | NOT_STARTED | — |
| 27 | [Actividad y receipts](27-actividad-y-receipts.md) | NOT_STARTED | — |
| 28 | [Forecast y escenarios](28-forecast-y-escenarios.md) | NOT_STARTED | — |
| 29 | [Pedido y handoff operativo](29-pedido-y-handoff-operativo.md) | NOT_STARTED | — |
| 30 | [Renovación y expansión](30-renovacion-y-expansion.md) | NOT_STARTED | Informe |
| 31 | [QA de conversación comercial](31-qa-de-conversacion-comercial.md) | NOT_STARTED | — |
| 32 | [Métricas comerciales y cohortes](32-metricas-comerciales-y-cohortes.md) | NOT_STARTED | — |
| 33 | [Reportes, dashboard e infografías](33-reportes-dashboard-e-infografias.md) | NOT_STARTED | — |
| 34 | [Portal responsive, chat y Anam](34-portal-responsive-chat-y-anam.md) | NOT_STARTED | — |
| 35 | [SDK TypeScript, Hono y tools](35-sdk-typescript-hono-y-tools.md) | NOT_STARTED | Informe |
| 36 | [Bridge de agente y eventos](36-bridge-de-agente-y-eventos.md) | NOT_STARTED | — |
| 37 | [Cooperación y handoff empresarial](37-cooperacion-y-handoff-empresarial.md) | NOT_STARTED | — |
| 38 | [Modelos, coste y observabilidad](38-modelos-coste-y-observabilidad.md) | NOT_STARTED | — |
| 39 | [Privacidad y pruebas adversariales](39-privacidad-y-pruebas-adversariales.md) | NOT_STARTED | — |
| 40 | [Vertical E2E y fallos distribuidos](40-vertical-e2e-y-fallos-distribuidos.md) | NOT_STARTED | Informe |
| 41 | [Operaciones, CI, backup y release](41-operaciones-ci-backup-y-release.md) | NOT_STARTED | — |
| 42 | [Aceptación, evidencia y handoff final](42-aceptacion-evidencia-y-handoff-final.md) | NOT_STARTED | Informe |

Informe: SHA/PR/diff, versiones/entorno, fases PASS/BLOCKED/NOT_VERIFIED, tests realmente ejecutados/pasados/fallidos/skipped, fixtures/receipts/fuentes, costo/riesgos y siguiente dependencia. No contar escenarios planeados como tests. STOP ante fuga, bypass de autorización/revisión, secreto, doble efecto o pérdida de audit. Producción/pagos/firmas/actos regulados fuera de esta entrega.
