# Informe consolidado VTA-C07 — VTA-C42

Rama aislada `impl/factory-c01-c05`. Nada empujado, nada desplegado, `main`
intacto. Este documento cubre las 36 campañas restantes con el mismo criterio
que los informes C01–C06: **un mock no acredita un proveedor y un documento no
es un test.**

- SHA base del programa: `3e9ae1c8bc28b3a37741eb36a77c1235e523e7b8`.
- Implementación: `packages/sales` (lógica comercial determinista), migración
  `db/migrations/0002_domain.sql` (tablas de dominio + RLS forzada), grants
  locales y pruebas.
- Fecha de ejecución: 2026-11-15.

## Comandos ejecutados (esta sesión)

```bash
pnpm install            # EXIT=0 (lockfile preservado)
pnpm run typecheck      # EXIT=0 (contracts, domain, identity, sales, persistence, api)
pnpm run test           # EXIT=0
```

Conteo real tras la ejecución:

| Paquete | Archivos | Pruebas |
|---|---|---|
| contracts | 1 | 12 |
| domain | 1 | 13 |
| identity | 3 | 28 |
| sales | 8 | 81 |
| persistence | 4 | 22 |
| api | 2 | 20 |
| **total** | **19** | **176** |

Entorno: Node v26.13.0, pnpm 10.34.9, PGlite (PostgreSQL WASM) como motor de
pruebas. Docker no es utilizable en este host (`permission denied` en
`/var/run/docker.sock`), así que no hay Postgres servidor real.

## Matriz por campaña

Estados: **IMPLEMENTED** = código propio con pruebas que pasan y comando
registrado; **PARTIAL** = parte local verificada, parte externa no;
**STUB** = existe y falla cerrado, no acredita al proveedor;
**DOCUMENTED** = decisión/evidencia sin código ejecutable.

| Campaña | Superficie implementada | Estado | Prueba |
|---|---|---|---|
| C07 Mandatos, finalidad y aprobaciones | `governance.ts`: aprobación ligada a `payloadHash`/`resourceVersion`/`rightsHash`/`policyHash`/destinatario/canal, caducidad, revocación, techo de coste e invalidación por cambio material | IMPLEMENTED | `governance.test.ts` |
| C08 Secretos, discovery y aislamiento | `operations.ts`: rechazo de material secreto en payloads, endpoint de discovery https + allowlist + sin credenciales + sin host privado | IMPLEMENTED (local) | `operations.test.ts` |
| C09 Directorio y representación | `core.ts`: deduplicación de cuentas/contactos, homónimos, crédito de fuente | IMPLEMENTED | `core.test.ts` |
| C10 Candidatos y aceptación | `core.ts`: aceptación idempotente por clave de operación, permiso por canal, expiración | IMPLEMENTED | `core.test.ts` |
| C11 Pipeline y etapas | `core.ts`: FSM de etapas con transiciones ilegales rechazadas | IMPLEMENTED | `core.test.ts` |
| C12 Triage y cualificación | `core.ts`: hechos con `sourceRef`, propuesta del LLM, decisión determinista del core | IMPLEMENTED | `core.test.ts` |
| C13 Fuentes y contexto de cuenta | `core.ts`: solo hechos con evidencia, guarda de inyección de prompt | PARTIAL — recuperación real de fuentes no ejecutada | `core.test.ts` |
| C14 Adaptador CRM Twenty | `adapters.ts`: informe de capacidad `documented`; cualquier llamada lanza `PROVIDER_NOT_CONFIGURED` | STUB | `adapters.test.ts` |
| C15 Frappe/Espo/Suite | `adapters.ts`: informes de capacidad; escritura verificada lanza `NOT_IMPLEMENTED` | STUB | `adapters.test.ts` |
| C16 Import y conflictos | `operations.ts`: preview, duplicados, conflicto sobre contenido revisado, cursor sin retroceso | IMPLEMENTED | `operations.test.ts` |
| C17 Catálogo y disponibilidad | `pricing.ts`: frescura, fecha de stock, aserción de entrega obligatoria | IMPLEMENTED | `pricing.test.ts` |
| C18 Pricebook y tarifas | `pricing.ts`: resolución de precio efectivo, versión de pricebook, moneda | IMPLEMENTED | `pricing.test.ts` |
| C19 CPQ y redondeo | `pricing.ts`: totales con Decimal, política de redondeo explícita, determinismo | IMPLEMENTED | `pricing.test.ts` |
| C20 Mandatos de descuento | `pricing.ts`: tope agregado, evasión por split, caducidad, tope por importe | IMPLEMENTED | `pricing.test.ts` |
| C21 Propuesta y versiones | `commercial.ts`: hash estable, hecho sin evidencia rechazado, inferencia marcada | IMPLEMENTED | `commercial.test.ts` |
| C22 Firma electrónica | `adapters.ts`: puerto deshabilitado (`NOT_IMPLEMENTED`) | STUB | `adapters.test.ts` |
| C23 Reuniones y calendario | `commercial.ts`: idempotencia por clave, franja ambigua de cambio de hora marcada `uncertain` | IMPLEMENTED (calendario externo no) | `commercial.test.ts` |
| C24 Correo comercial supervisado | `commercial.ts`: preview sink-only, allowlist, supresión, hash del borrador, `externalEffect: false` | IMPLEMENTED (envío real no) | `commercial.test.ts` |
| C25 Secuencias y oposición | `commercial.ts`: re-chequeo de oposición, supresión, tope de pasos, permiso de canal | IMPLEMENTED | `commercial.test.ts` |
| C26 Inbox y toma humana | `commercial.ts`: takeover silencia el twin y cancela solo sus jobs | IMPLEMENTED (inbox UI no) | `commercial.test.ts` |
| C27 Actividad y receipts | `outcomes.ts`: sin receipt → `outcome_unknown`, nunca confirmado | IMPLEMENTED | `outcomes.test.ts` |
| C28 Forecast y escenarios | `outcomes.ts`: bruto vs ponderado, versión de probabilidad, cobertura, `isRevenue: false` | IMPLEMENTED | `outcomes.test.ts` |
| C29 Pedido y handoff operativo | `operations.ts`: exige quote aceptada + receptor + ACK | IMPLEMENTED (proveedor operativo no) | `operations.test.ts` |
| C30 Renovación y expansión | `operations.ts`: cambio de precio sin aprobación rechazado, moneda coherente | IMPLEMENTED | `operations.test.ts` |
| C31 QA de conversación | `governance.ts`: trayectoria con paso prohibido falla aunque la respuesta final sea correcta | IMPLEMENTED | `governance.test.ts` |
| C32 Métricas y cohortes | `outcomes.ts`: duplicados eliminados, denominador explícito, tasa en bps | IMPLEMENTED | `outcomes.test.ts` |
| C33 Reportes y dashboard | `outcomes.ts`: snapshot con `null` para dato ausente y bandera `stale` | PARTIAL — sin UI ni infografías | `outcomes.test.ts` |
| C34 Portal responsive, chat y Anam | `adapters.ts`: `PORTAL` declarado `not_implemented` | STUB | `adapters.test.ts` |
| C35 SDK TypeScript, Hono y tools | `adapters.ts`: superficie de tools del modelo sin aprobación, guarda de capability | PARTIAL — paquete SDK publicable no | `adapters.test.ts` |
| C36 Bridge de agente y eventos | `adapters.ts`: `HOST_BRIDGE` no mapea eventos (`HOST_BRIDGE_NOT_VERIFIED`) | STUB | `adapters.test.ts` |
| C37 Cooperación y handoff | `governance.ts`: FSM con ACK propio para reconocer y para completar | IMPLEMENTED | `governance.test.ts` |
| C38 Modelos, coste y observabilidad | `governance.ts`: reserva de presupuesto idempotente, reconciliación, techo | PARTIAL — sin metering del proveedor | `governance.test.ts` |
| C39 Privacidad y adversariales | `governance.ts` + `core.ts`: identidad/representación, plan de supresión no ejecutado, inyección de prompt | IMPLEMENTED (local) | `governance.test.ts`, `core.test.ts` |
| C40 Vertical E2E y fallos | `e2e.ts`: vertical sintético completo con 11 pasos, efectos externos en cero; `reconcileAfterTimeout` | IMPLEMENTED (local) — red real STUB | `e2e.test.ts` |
| C41 Operaciones, CI, backup y release | `operations.ts`: plan de restore (restricciones reaplicadas, jobs huérfanos bloqueados); `OPERATIONS_STATUS` declara CI/backups/observabilidad `NOT_CONFIGURED` | STUB (local) — no hay CI ni backup en el repo | `operations.test.ts` |
| C42 Aceptación, evidencia y handoff | Este informe + matriz + `HANDOFF-SHA.md` | DOCUMENTED | — |

## Base de datos

`db/migrations/0002_domain.sql` añade 10 tablas de dominio (`accounts`,
`contacts`, `contact_channels`, `candidates`, `suppressions`, `opportunities`,
`activities`, `quotes`, `approvals`, `handoffs`) con:

- `tenant_id` en toda fila y **FKs compuestas** `(tenant_id, id)`: una fila de un
  tenant no puede referenciar la de otro.
- **RLS habilitada y forzada** en las 10 tablas, con política
  `tenant_id = app.current_tenant_id()` y `with check` para escrituras.
- Restricciones que repiten en la base los invariantes del dominio: actividad
  confirmada necesita `receipt_ref`; handoff en `working`/`completed` necesita
  `ack_ref`; permiso de candidato todo-o-nada; cotización no negativa; moneda
  ISO de 3 letras.
- Idempotencia de migración con checksum (runner existente) y rollback de
  migraciones fallidas.

Verificado en `domain-rls.test.ts` y `migrate.test.ts`:

- aislamiento por tenant en lectura;
- 0 filas sin `app.tenant_id` (ejecutando como rol `app_user`, sin superusuario);
- escritura cross-tenant rechazada por RLS;
- contacto colgado de la cuenta de otro tenant rechazado por FK;
- invariantes de `check` rechazados;
- las 15 tablas con `relrowsecurity` y `relforcerowsecurity` en `true`.

## Stubs explícitos (fallan cerrado)

| Stub | Comportamiento | Código |
|---|---|---|
| Adaptadores CRM (Twenty, Frappe, Espo, Suite) | informan capacidad, nunca escriben | `PROVIDER_NOT_CONFIGURED` (503) / `NOT_IMPLEMENTED` (501) |
| Firma electrónica | puerto deshabilitado | `NOT_IMPLEMENTED` |
| Cobro / checkout | puerto deshabilitado | `NOT_IMPLEMENTED` |
| Portal + Anam | declarado no implementado | `PORTAL.status = "not_implemented"` |
| Bridge al agente padre | no mapea eventos | `HOST_BRIDGE_NOT_VERIFIED` |
| Envío de correo real | solo preview en sink | `mode: "sink_only"` |
| Calendario real | propuesta local, sin proveedor | `status: "proposed"` |
| CI, backups, observabilidad | declarados ausentes | `OPERATIONS_STATUS` |
| Supabase real, JWKS, Storage, Realtime, pooler | no ejecutado | `NOT_VERIFIED` |

## Lo que este trabajo NO hizo

- No añadió endpoints HTTP por campaña: la API sigue exponiendo `/health` y
  `/v1/ventas/me`. Las capacidades viven como funciones de dominio probadas.
- No llamó a ningún proveedor, no envió correo, no firmó, no cobró, no desplegó,
  no creó usuarios ni tocó producción.
- No modificó el repositorio padre, `main`, ni ramas de otros agentes.
- No ejecutó Supabase, Docker ni Postgres servidor: la evidencia de base de datos
  es PGlite y el adaptador `pg` sigue `NOT_VERIFIED` contra un servidor real.
- No creó interfaz de usuario (dashboard, portal, inbox) ni empaquetó un SDK
  publicable.

## Reproducción

```bash
export PATH="$HOME/.local/bin:$PATH"   # pnpm local, sin root
pnpm install                            # EXIT=0
pnpm run typecheck                      # EXIT=0
pnpm run test                           # EXIT=0, 176 pruebas / 19 archivos
```

Cualquier gate marcado IMPLEMENTED arriba tiene su archivo de prueba en
`packages/sales/src/*.test.ts`, `packages/persistence/src/*.test.ts` o
`apps/api/src/*.test.ts`. Un PASS sin comando y salida debe tratarse como
hallazgo de auditoría.
