# Investigación y decisiones

Fuentes primarias consultadas selectivamente 2026-11-13; no revisión sistemática ni benchmarks reproducidos. El registro separa abstract/README/documentación/anuncio, acceso fallido y validación de runtime. Revalidar al implementar porque versiones, planes y leyes pueden cambiar.

| Paper | Decisión de diseño (inferencia propia) |
|---|---|
| P01: Selling in the Wild · [arXiv](https://arxiv.org/abs/2610.25461) | Preprint de proveedor con evaluación simulada y de campo: estudiar protocolo y guardrails, sin trasladar ingresos/tasas al SaaS. |
| P02: R2A-Sales · [arXiv](https://arxiv.org/abs/2610.34185) | Verificar acciones comprometidas y restricciones, no solo que el agente recite políticas. Sus dominios/idioma no prueban cobertura ES/EN/FR. |
| P03: CRM-Agent-Bench · [arXiv](https://arxiv.org/abs/2610.32004) | Contratos sobre trayectoria, estado objetivo y estado protegido; fixtures originales sin copiar datos. |

No se trasladan scores, porcentajes, tamaños de muestra o eficacia de los autores a Agntia. Leer un abstract no demuestra replicación de método o licencia de sus datasets. Se diseñarán fixtures originales con datos sintéticos y criterios de estado/efecto/proceso; antes de incorporar harness/datos ajenos revisar licencia, splits, dependencia de modelos y términos.

## Conceptos propuestos

Evidence-to-Effect Ledger une fuente, versión, actor, mandato, propuesta, approval y resultado confirmado. Scope-bound Twin conserva una identidad canónica y especialización local por cliente sin memoria global. Reviewable Decision Contract define hechos, estado protegido, resultado y qué requiere humano/competencia. Son propuestas de ingeniería de esta entrega, no afirmación de novedad científica o patente.

Para Ventas y operaciones comerciales, la decisión particular es: QuoteTotals: sumar cantidad×precio unitario con Decimal, descuentos según ámbito/orden explícito, moneda/redondeo y tax mapping aprobado por fuentes; no inferir impuestos. Congelar priceBook/version/stock/delivery assertions. Forecast es un snapshot de escenarios, no ingreso cobrado ni garantía.

## Referentes actuales

| Referencia | Patrón estudiado |
|---|---|
| V01: HubSpot prospecting | Planificación/revisión de prospección y fuentes; verificar scopes, créditos y sandbox antes de integrarlo. |
| V02: Salesforce Sales | Contexto CRM y acciones de negocio; no se declara plan/API habilitado por esta lectura. |
| V03: Gong | Patrón de pipeline/forecast y actividad; URL inicial de agentes no accesible, página platform consultada. |

Las páginas oficiales describen oferta y novedades, no se probaron productos ni cuentas. No adoptar sus claims de cumplimiento, seguridad, productividad o certificaciones como propios. API/plan/edición/territorio y coste son gates de implementación. Fuentes no accesibles se registran, no sustituyen con una afirmación de capacidad. Algunas URLs cambian de ruta o versión: conservar el origen/redirect y no fijar un endpoint por memoria.

## Repos públicos

Se consultaron metadatos, SHA y README de los candidatos de [repositories.json](research/repositories.json). No son una auditoría completa ni se han instalado. Rama main/master/develop/hotfix no es un pin de release. Selección posterior por compatibilidad/licencia/recursos/ACL y evidencia con una instancia aislada. Twenty requiere revisar AGPL/excepción de interfaces/archivos Enterprise y paquetes MIT. Frappe CRM/EspoCRM/SuiteCRM son candidatos AGPL según metadatos; módulos, distribución y APIs se verifican individualmente. Documenso es puerto de firma optativo, no permiso de firmar ni equivalencia universal de firma electrónica.

## Fuentes jurídicas y de seguridad

Supabase JWT/RLS y Anam se estudiaron en documentación oficial; nunca credenciales ni sesiones reales. Normativa común y específica en Dxx requiere interpretación contextual, territorio/fecha y revisión humana. No prometer cumplimiento universal por importar una librería o tener un dashboard. Un uso no cubierto debe quedar unsupported/needs_review.

| Fuente específica | Qué exige al diseño |
|---|---|
| D01: [LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758) | Finalidad comercial y oposición, revisión contextual; no todo lead permite outreach. |
| D02: [eIDAS](https://eur-lex.europa.eu/eli/reg/2014/910/oj) | Tipos de firma y contexto deben revisarse; API de firma no prueba representación o requisitos del acto. |

Mantener preguntas abiertas: derechos/ediciones, fuente incompleta, verificación real de proveedor, operación humana y coste medido. El mapa del padre conserva lecturas heredadas y nuevas por el mismo SHA; no supone una relectura total. Cualquier divergencia futura se coteja antes del wiring. Nunca modificar el padre para que una prueba propia pase.
