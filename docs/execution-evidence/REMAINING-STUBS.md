# Stubs declarados — bloque C07–C42

Este documento es la cara legible de `packages/sales/src/stubs.ts`
(`CAPABILITY_STUBS`). La lista vive en código para que no se pueda afirmar una
capacidad sin que exista su stub, y `stubs.test.ts` comprueba que:

- los `id` son únicos;
- cada `failClosedWith` pertenece al catálogo cerrado de `@agntia-ventas/contracts`;
- cada stub tiene requisitos declarados (nombres de variables, nunca valores);
- `stubCapability(id)` lanza el código declarado y no devuelve nada;
- las campañas con parte externa abierta (C13, C14, C15, C22, C33, C34, C35,
  C36, C38, C41, C42) están cubiertas.

Un stub **no** es una capacidad instalada: es un fallo cerrado declarado.
Ninguno cae a un camino de admin/owner/default.

| id | Campaña | Capacidad | Estado | Falla con | Código | Requisitos (nombres) |
|---|---|---|---|---|---|---|
| `c13-source-provider` | C13 | API de búsqueda del proveedor de fuentes | STUB | `PROVIDER_NOT_CONFIGURED` | `packages/sales/src/sources.ts#SOURCE_STATUS` | `SOURCE_PROVIDER_BASE_URL`, `SOURCE_PROVIDER_KEY_REF`, `SOURCE_ALLOWED_HOSTS` |
| `c14-crm-twenty-write` | C14 | escritura en Twenty CRM | NOT_VERIFIED | `PROVIDER_NOT_CONFIGURED` | `packages/sales/src/crm.ts#createCrmGateway` | `CRM_BASE_URL`, `CRM_TOKEN_REF` |
| `c15-crm-frappe-espo-suite` | C15 | adaptadores Frappe/Espo/Suite | NOT_VERIFIED | `PROVIDER_NOT_CONFIGURED` | `packages/sales/src/adapters.ts#FRAPPE_ADAPTER` | `CRM_BASE_URL`, `CRM_TOKEN_REF`, `CRM_VENDOR` |
| `c22-signature-provider` | C22 | proveedor de firma electrónica | NOT_VERIFIED | `PROVIDER_NOT_CONFIGURED` | `packages/sales/src/signature.ts#verifySignatureWebhook` | `SIGNATURE_WEBHOOK_SECRET_REF`, `SIGNATURE_PROVIDER` |
| `c24-email-send` | C24 | envío real de correo supervisado | STUB | `NOT_IMPLEMENTED` | `packages/sales/src/commercial.ts#planEmailDraft` | `EMAIL_PROVIDER_KEY_REF`, `EMAIL_SENDER_DOMAIN` |
| `c25-sequence-scheduler` | C25 | scheduler de secuencias salientes | STUB | `NOT_IMPLEMENTED` | `packages/sales/src/commercial.ts#nextSequenceStep` | `SCHEDULER_WORKER`, `SUPPRESSION_STORE` |
| `c26-inbox-ui` | C26 | inbox de toma humana | STUB | `NOT_IMPLEMENTED` | `packages/sales/src/commercial.ts#takeOverConversation` | `INBOX_UI` |
| `c29-operations-receiver` | C29 | sistema receptor de operaciones | STUB | `NOT_IMPLEMENTED` | `packages/sales/src/operations.ts#proposeOrder` | `OPERATIONS_RECEIVER_ENDPOINT`, `OPERATIONS_ACK_ENDPOINT` |
| `c33-dashboard-live-data` | C33 | datos en vivo y gráficas del dashboard | STUB | `DEPENDENCY_UNAVAILABLE` | `packages/sales/src/dashboard.ts#DASHBOARD_STATUS` | `REPORT_QUERY_STORE` |
| `c34-portal-chat-anam` | C34 | chat del portal y presencia Anam | STUB | `NOT_IMPLEMENTED` | `packages/sales/src/adapters.ts#PORTAL` | `ANAM_API_KEY_REF`, `PORTAL_CHAT_SERVICE` |
| `c35-sdk-publication` | C35 | publicación del SDK TypeScript | STUB | `NOT_IMPLEMENTED` | `packages/sales/src/client.ts#SalesClient` | `NPM_PUBLISH_TOKEN`, `PACKAGE_SCOPE_APPROVAL` |
| `c36-parent-transport` | C36 | transporte y ACK al agente padre | NOT_VERIFIED | `NOT_IMPLEMENTED` | `packages/sales/src/outbox.ts#PARENT_TRANSPORT_STUB` + `packages/persistence/src/outbox-repository.ts` | `HOST_BRIDGE_BASE_URL`, `HOST_BRIDGE_SIGNING_KEY_REF`, `HOST_BRIDGE_EVENT_SCHEMA_VERSION` |
| `c38-provider-metering` | C38 | metering de tokens del proveedor | STUB | `PROVIDER_NOT_CONFIGURED` | `packages/sales/src/costs.ts#estimateModelCost` | `METERING_PROVIDER_KEY_REF` |
| `c40-real-network` | C40 | vertical E2E contra red y proveedores reales | STUB | `NOT_IMPLEMENTED` | `packages/sales/src/e2e.ts#runVerticalE2e` | `STAGING_TENANT`, `PROVIDER_SANDBOX_KEYS` |
| `c41-ci-backup-observability` | C41 | CI ejecutada, backups y observabilidad | NOT_VERIFIED | `DEPENDENCY_UNAVAILABLE` | `packages/sales/src/operations.ts#OPERATIONS_STATUS` | `CI_RUNNER`, `BACKUP_TARGET`, `OTEL_ENDPOINT` |
| `c42-human-acceptance` | C42 | aceptación de negocio y firma del handoff | NOT_VERIFIED | `PROVIDER_NOT_CONFIGURED` | `docs/execution-evidence/C07-C42-REPORT.md` | `ACCEPTANCE_OWNER`, `SIGNED_HANDOFF` |

## Qué sí quedó ejecutable en esta pasada

Estas superficies no son stubs; tienen prueba y comando registrado en
`C07-C42-REPORT.md`:

- **C13 — recuperación de fuentes** (`sources.ts`): https obligatorio, host
  allowlist (exacto o sufijo), sin credenciales, puerto 443, rechazo de IP,
  loopback y `.internal`; `redirect: "error"`; timeout con `AbortSignal`; tope
  de bytes; tipos MIME permitidos (`text/html`, `text/plain`,
  `application/json`); texto extraído sin `script`/`style`/comentarios; hash
  sha256 del cuerpo crudo; señales de inyección etiquetadas; y
  `qualificationFactFromSource`, que solo registra un hecho si aparece
  literalmente en el texto descargado (`EVIDENCE_REQUIRED` si no).
- **C33 — renderer del dashboard** (`dashboard.ts`): HTML de solo lectura,
  escapado de todos los valores, `null` mostrado como «sin dato», aviso de
  obsolescencia, previsión rotulada como «no es ingreso», tabla de conversión
  con «sin denominador» cuando el denominador es 0, CSP `default-src 'none'`
  (sin `script-src`) y `cache-control: no-store`.
- **C36/C38 — outbox** (`outbox.ts` + `outbox-repository.ts`): alta
  idempotente por `operation_key`, conflicto si cambia el payload, un solo
  intento en vuelo, techo de intentos, ACK con referencia (replay idempotente,
  conflicto de versión, ACK sin envío rechazado), timeout → `unknown` y
  reconciliación por búsqueda antes de permitir otro intento. La máquina de
  estados está persistida por tenant en `app.parent_outbox`
  (`db/migrations/0004_outbox.sql`, RLS forzada) y el intento se actualiza de
  forma condicional a los intentos leídos. Lo que sigue **stub** es el
  transporte al padre (`createParentTransport` → `NOT_IMPLEMENTED`): no hay
  endpoint, esquema de eventos ni ACK del padre verificados, y una entrada no
  pasa de `sent` sin ellos.
