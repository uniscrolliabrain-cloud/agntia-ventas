# AuthorityMap v1 — custodio de campo y ejecutor de efecto

**Estado: PROPOSED + parcialmente implementado en contratos (C02/C05).** No hay
integración de proveedor ni persistencia todavía. Este documento fija quién
custodia cada dato y quién puede ejecutar cada efecto para evitar doble efecto
entre Ventas y los repos hermanos (`docs/factory/05-INTERFACES-ADAPTERS.md`).

## Regla única

Para cada campo existe **un custodio** y para cada efecto **un ejecutor**. Si dos
flujos reclaman el mismo efecto se bloquea y se deduplica; no se compite con dos
llamadas. Un módulo local puede cubrir una función sin contratar un hermano, pero
no inventa autorización, saldo, dictamen o evidencia.

## Campos

| Campo / dato | Custodio | Ventas puede | Ventas no puede |
|---|---|---|---|
| Identidad y membership del usuario | Padre / Supabase Auth (provisionado) | Leer `sub` y membership activa verificada | Aceptar `user_metadata`, role del token o tenant del body |
| `Account`, `Contact`, `ChannelIdentity` | CRM elegido o core local (según tenant) | Proyectar con `EntityLink` y procedencia | Fusionar identidades por nombre/email; escribir sin AuthorityMap |
| Permiso de contacto y supresión | Ventas (fuente autorizada por tenant) | Bloquear envío si falta base o hay opt-out | Inferir consentimiento de un dato público |
| `Opportunity`, `PipelineStage` | Ventas | Transicionar con guards y `expectedVersion` | Marcar `won_verified` sin evidencia |
| Catálogo / stock / plazo | Fuente de producto del tenant | Leer con frescura y versión declaradas | Inventar producto, existencia o entrega |
| Precio y pricebook | Fuente de precios aprobada | Calcular totales con Decimal y política versionada | Fijar precio desde texto del modelo |
| Descuento | `DiscountMandate` del owner | Proponer dentro del mandato agregado | Repartir un descuento entre líneas para eludir el tope |
| Firma electrónica | Proveedor de firma (puerto) | Proponer envelope; registrar estado | Firmar, enviar o equiparar tipos de firma |
| Cobro / liquidación | Pasarela y Finanzas | Proponer `Order`/`PaymentIntent` deshabilitado | Asumir pago por crear enlace o por webhook no verificado |
| Factura | Gestoría | Solicitar/leer estado | Emitir factura propia |
| Forecast | Ventas (snapshot de escenarios) | Calcular con cobertura declarada | Presentarlo como ingreso cobrado |
| Handoff a operación | Receptor designado | Proponer y esperar ACK | Marcar completado sin ACK |
| Auditoría y evidencia | Ventas + Ciberseguridad (lectura) | Escribir refs y receipts minimizados | Almacenar PII/tokens/prompts privados en logs |

## Efectos y ejecutor único

| Efecto | Ejecutor designado | Precondición | Prueba de resultado |
|---|---|---|---|
| `sales.contacts.preview` | Ventas (lectura) | Scope de recurso/campo | `EvidenceRef` + revisión |
| `sales.candidates.accept` | Ventas | Admisión humana registrada | Lead aceptado idempotente |
| `sales.pipeline.transition` | Ventas | Guard de etapa + `expectedVersion` | Versión nueva + auditoría |
| `sales.quote.calculate` | Ventas (core determinista) | Pricebook vigente congelado | Totales Decimal + hash de payload |
| `sales.quote.propose` | Ventas | `ApprovalBinding` vigente para el hash | Revisión humana ligada a versión |
| `sales.email.preview` | Ventas (borrador) | Supresión + propósito + sink de piloto | Draft con hash; sin envío real |
| `sales.signature.propose` | Puerto de firma (DISABLED) | Representación probada | Estado del proveedor, no el chat |
| `sales.order.propose` | Ventas → operación | Quote aceptada + ACK del receptor | `HandoffReceipt` |
| `handoff.propose` | Ventas | Scope del receptor | ACK posterior al commit |

## Implementado en este repositorio

`packages/contracts/src/capabilities.ts` cierra el catálogo: capacidades
internas (baseline, migraciones, descubrimiento, release) **no** son superficie
del modelo, y aprobar/enviar/firmar/cobrar/exportar quedan fuera del catálogo
inicial. `packages/contracts/src/scopes.ts` obliga a `recurso:acción` y
`packages/identity/src/principal.ts` deriva scopes solo de la membership
provisionada.

Pendiente (campañas C06–C09): persistencia real del mapa, `ServiceAgreement`/
`WorkOrder` como DTO, y `EntityLink` entre custodio remoto y proyección local.
