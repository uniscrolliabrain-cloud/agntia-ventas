# Aceptación del piloto · pendiente

Todos los puntos **NOT_EXECUTED**; este diseño no acredita producto o aceptación del owner.

| Gate | Evidencia mínima |
|---|---|
| Baseline | SHAs/instrucciones/fuentes/licencias y diferencias |
| Identidad/twin | Supabase JWT, membership/ACL, mandato canónico, scope y revocación |
| Persistencia | FK/RLS/roles reales, CAS/audit/outbox, restore |
| Datos | Fuentes, originales, hash/revisión, missing/stale/conflict explícitos |
| Dominio | Resultado y estado protegido conforme invariantes de cada módulo |
| Revisión | Humano/competencia/representación cuando aplique, approval exacta y vigente |
| Efecto | Intent/key/payloadHash/emisor único, receipt o incertidumbre visible |
| Seguridad | Dos tenants y recursos internos, secretos, prompt injection, SSRF |
| UI/AV | Responsive, accesibilidad/ES-EN-FR, Anam scoped o fallback texto |
| Operación | Backup/restore/rotación/retención/runbooks/costes medidos |
| Integración | Contratos API-SDK-host, fake separado de runtime real, padre intacto |

Vertical: Candidato sintético → aceptación humana → oportunidad → catálogo/precio vigente → quote calculada → revisión → envío a sink → receipt → reunión simulada → handoff con ACK.

Límite: Sin mensajes comerciales reales, alta automática de leads por scraping, firma/contrato, cobro, descuentos fuera de mandato o compromisos de entrega durante el piloto. Cotización y envío son capacidades distintas; datos públicos no prueban permiso para contactar. Criterio particular: QuoteTotals: sumar cantidad×precio unitario con Decimal, descuentos según ámbito/orden explícito, moneda/redondeo y tax mapping aprobado por fuentes; no inferir impuestos. Congelar priceBook/version/stock/delivery assertions. Forecast es un snapshot de escenarios, no ingreso cobrado ni garantía.

Ejecutar E2E A–I y escenarios de [evaluación](../09-evaluacion.md).0 fuga tenant/recurso,0 secretos centinela,0 approvals/competencia fabricadas,0 duplicado replay y0 efecto fuera de alcance. Un crítico fallido bloquea. p50/p95/coste/calidad/cobertura se miden con entorno/workload/versión; no objetivos ya alcanzados ficticios.

Capacidad opcional sin proveedor/licencia/permiso queda disabled y NOT_VERIFIED; no se oferta como soportada. Un mock PASS no acredita la instalación. Datos reales/producción/compras/wiring en padre necesitan otra autorización. El owner debe poder reconstruir un entregable desde fuente y actor hasta revisión/receipt y entender qué sigue pendiente.
