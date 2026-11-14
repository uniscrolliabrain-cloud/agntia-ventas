# Dependencias y campañas de Ventas

42 campañas diseñadas antes de ejecutar, sin auditoría Astra ni Codex entre fases. Orden recomendado 001→042, respetando grafo original.

| ID | Campaña | Dependencias | Operación |
|---|---|---|---|
| VTA-C01 | [Baseline, fuentes y alcance](campaigns/001/CAMPAIGN.md) | — | `baseline.capture` |
| VTA-C02 | [Autoridad por dominio y contrato SaaS](campaigns/002/CAMPAIGN.md) | VTA-C01 | `authority.define` |
| VTA-C03 | [Supabase JWT y principal](campaigns/003/CAMPAIGN.md) | VTA-C02 | `auth.verify` |
| VTA-C04 | [Twins y nomenclatura canónica](campaigns/004/CAMPAIGN.md) | VTA-C03 | `twin.bind` |
| VTA-C05 | [DTOs, esquemas y errores](campaigns/005/CAMPAIGN.md) | VTA-C04 | `contracts.validate` |
| VTA-C06 | [Persistencia, RLS y migraciones](campaigns/006/CAMPAIGN.md) | VTA-C05 | `storage.migrate` |
| VTA-C07 | [Mandatos, finalidad y aprobaciones](campaigns/007/CAMPAIGN.md) | VTA-C06 | `approval.preview` |
| VTA-C08 | [Secretos, discovery y aislamiento remoto](campaigns/008/CAMPAIGN.md) | VTA-C07 | `provider.discover` |
| VTA-C09 | [Directorio y representación](campaigns/009/CAMPAIGN.md) | VTA-C08 | `sales.contacts.preview` |
| VTA-C10 | [Candidatos y aceptación](campaigns/010/CAMPAIGN.md) | VTA-C09 | `sales.candidates.accept` |
| VTA-C11 | [Pipeline y etapas](campaigns/011/CAMPAIGN.md) | VTA-C10 | `sales.pipeline.transition` |
| VTA-C12 | [Triage y cualificación](campaigns/012/CAMPAIGN.md) | VTA-C11 | `sales.qualification.propose` |
| VTA-C13 | [Fuentes y contexto de cuenta](campaigns/013/CAMPAIGN.md) | VTA-C12 | `sales.account.context` |
| VTA-C14 | [Adaptador CRM Twenty](campaigns/014/CAMPAIGN.md) | VTA-C13 | `sales.twenty.preview` |
| VTA-C15 | [Adaptadores Frappe/Espo/Suite](campaigns/015/CAMPAIGN.md) | VTA-C14 | `sales.crm.import` |
| VTA-C16 | [Import y conflictos](campaigns/016/CAMPAIGN.md) | VTA-C15 | `sales.import.preview` |
| VTA-C17 | [Catálogo y disponibilidad](campaigns/017/CAMPAIGN.md) | VTA-C16 | `sales.catalog.read` |
| VTA-C18 | [Pricebook y tarifas](campaigns/018/CAMPAIGN.md) | VTA-C17 | `sales.price.preview` |
| VTA-C19 | [CPQ y redondeo](campaigns/019/CAMPAIGN.md) | VTA-C18 | `sales.quote.calculate` |
| VTA-C20 | [Mandatos de descuento](campaigns/020/CAMPAIGN.md) | VTA-C19 | `sales.discount.propose` |
| VTA-C21 | [Propuesta y versiones](campaigns/021/CAMPAIGN.md) | VTA-C20 | `sales.quote.propose` |
| VTA-C22 | [Firma electrónica como puerto](campaigns/022/CAMPAIGN.md) | VTA-C21 | `sales.signature.propose` |
| VTA-C23 | [Reuniones y calendario](campaigns/023/CAMPAIGN.md) | VTA-C22 | `sales.meeting.preview` |
| VTA-C24 | [Correo comercial supervisado](campaigns/024/CAMPAIGN.md) | VTA-C23 | `sales.email.preview` |
| VTA-C25 | [Secuencias y oposición](campaigns/025/CAMPAIGN.md) | VTA-C24 | `sales.followup.propose` |
| VTA-C26 | [Inbox y toma humana](campaigns/026/CAMPAIGN.md) | VTA-C25 | `sales.handoff.preview` |
| VTA-C27 | [Actividad y receipts](campaigns/027/CAMPAIGN.md) | VTA-C26 | `sales.activity.log` |
| VTA-C28 | [Forecast y escenarios](campaigns/028/CAMPAIGN.md) | VTA-C27 | `sales.forecast.run` |
| VTA-C29 | [Pedido y handoff operativo](campaigns/029/CAMPAIGN.md) | VTA-C28 | `sales.order.propose` |
| VTA-C30 | [Renovación y expansión](campaigns/030/CAMPAIGN.md) | VTA-C29 | `sales.renewal.propose` |
| VTA-C31 | [QA de conversación comercial](campaigns/031/CAMPAIGN.md) | VTA-C30 | `sales.quality.evaluate` |
| VTA-C32 | [Métricas comerciales y cohortes](campaigns/032/CAMPAIGN.md) | VTA-C31 | `sales.metrics.snapshot` |
| VTA-C33 | [Reportes, dashboard e infografías](campaigns/033/CAMPAIGN.md) | VTA-C32 | `report.snapshot` |
| VTA-C34 | [Portal responsive, chat y Anam](campaigns/034/CAMPAIGN.md) | VTA-C33 | `advisor.session` |
| VTA-C35 | [SDK TypeScript, Hono y tools](campaigns/035/CAMPAIGN.md) | VTA-C34 | `sdk.contract` |
| VTA-C36 | [Bridge de agente y eventos](campaigns/036/CAMPAIGN.md) | VTA-C35 | `host.bridge` |
| VTA-C37 | [Cooperación y handoff empresarial](campaigns/037/CAMPAIGN.md) | VTA-C36 | `handoff.propose` |
| VTA-C38 | [Modelos, coste y observabilidad](campaigns/038/CAMPAIGN.md) | VTA-C37 | `usage.measure` |
| VTA-C39 | [Privacidad y pruebas adversariales](campaigns/039/CAMPAIGN.md) | VTA-C38 | `security.verify` |
| VTA-C40 | [Vertical E2E y fallos distribuidos](campaigns/040/CAMPAIGN.md) | VTA-C39 | `e2e.verify` |
| VTA-C41 | [Operaciones, CI, backup y release](campaigns/041/CAMPAIGN.md) | VTA-C40 | `release.prepare` |
| VTA-C42 | [Aceptación, evidencia y handoff final](campaigns/042/CAMPAIGN.md) | VTA-C41 | `pilot.accept` |
