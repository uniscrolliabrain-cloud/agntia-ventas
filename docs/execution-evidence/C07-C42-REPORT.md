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

Reejecutado el 2026-11-18 tras restaurar el workspace: `pnpm install
--frozen-lockfile` EXIT=0, `pnpm run typecheck` EXIT=0 y `pnpm run test`
EXIT=0. Nada empujado y nada desplegado.

Conteo real tras la ejecución:

| Paquete | Archivos | Pruebas |
|---|---|---|
| contracts | 1 | 12 |
| domain | 1 | 14 |
| identity | 3 | 28 |
| sales | 14 | 149 |
| persistence | 6 | 38 |
| api | 5 | 44 |
| **total** | **30** | **285** |

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
| C07 Mandatos, finalidad y aprobaciones | `governance.ts` (binding a `payloadHash`/`resourceVersion`/`rightsHash`/`policyHash`/destinatario/canal, caducidad, revocación, techo) + `commercial-repository.ts` (aprobación persistida con clave de operación y revocación por versión) | IMPLEMENTED (persistido en PGlite) | `governance.test.ts`, `commercial-repository.test.ts` |
| C08 Secretos, discovery y aislamiento | `operations.ts`: rechazo de material secreto en payloads, endpoint de discovery https + allowlist + sin credenciales + sin host privado | IMPLEMENTED (local) | `operations.test.ts` |
| C09 Directorio y representación | `core.ts`: deduplicación de cuentas/contactos, homónimos, crédito de fuente | IMPLEMENTED | `core.test.ts` |
| C10 Candidatos y aceptación | `core.ts`: aceptación idempotente por clave de operación, permiso por canal, expiración | IMPLEMENTED | `core.test.ts` |
| C11 Pipeline y etapas | `core.ts`: FSM de etapas con transiciones ilegales rechazadas | IMPLEMENTED | `core.test.ts` |
| C12 Triage y cualificación | `core.ts`: hechos con `sourceRef`, propuesta del LLM, decisión determinista del core | IMPLEMENTED | `core.test.ts` |
| C13 Fuentes y contexto de cuenta | `core.ts`: solo hechos con evidencia, guarda de inyección; `sources.ts`: recuperación https con allowlist (exacta o sufijo), sin credenciales, puerto 443, rechazo de IP/loopback/`.internal`, `redirect: "error"`, timeout con `AbortSignal`, tope de bytes, MIME permitido, texto sin `script`/`style`/comentarios, hash sha256 del cuerpo y señales de inyección etiquetadas; `qualificationFactFromSource` solo acepta un hecho que aparece literalmente en el texto | PARTIAL — recuperación local probada; API del proveedor de fuentes STUB | `core.test.ts`, `sources.test.ts` |
| C14 Adaptador CRM Twenty | `crm.ts`: gateway HTTP real con fetch inyectado, host allowlist, secreto resuelto en servidor, timeout con reconciliación, esquema de respuesta validado, escritura con clave de idempotencia | PARTIAL — sin proveedor real | `integrations.test.ts`, `adapters.test.ts` |
| C15 Frappe/Espo/Suite | `crm.ts` cubre la forma común de los cuatro; `adapters.ts` sigue declarando capacidad `documented` y sin escritura verificada | PARTIAL | `integrations.test.ts` |
| C16 Import y conflictos | `operations.ts`: preview, duplicados, conflicto sobre contenido revisado, cursor sin retroceso | IMPLEMENTED | `operations.test.ts` |
| C17 Catálogo y disponibilidad | `pricing.ts`: frescura, fecha de stock, aserción de entrega obligatoria | IMPLEMENTED | `pricing.test.ts` |
| C18 Pricebook y tarifas | `pricing.ts`: resolución de precio efectivo, versión de pricebook, moneda | IMPLEMENTED | `pricing.test.ts` |
| C19 CPQ y redondeo | `pricing.ts`: totales con Decimal, política de redondeo explícita, determinismo; cotización persistida con `content_hash` y replay idempotente | IMPLEMENTED | `pricing.test.ts`, `commercial-repository.test.ts` |
| C20 Mandatos de descuento | `pricing.ts`: tope agregado, evasión por split, caducidad, tope por importe | IMPLEMENTED | `pricing.test.ts` |
| C21 Propuesta y versiones | `commercial.ts`: hash estable, hecho sin evidencia rechazado, inferencia marcada | IMPLEMENTED | `commercial.test.ts` |
| C22 Firma electrónica | `signature.ts`: verificación HMAC-SHA256 sobre `timestamp.rawBody`, ventana anti-replay, binding al hash del documento aprobado; `isContractAccepted: false`. Puerto sigue cerrado sin proveedor | PARTIAL — proveedor no configurado | `integrations.test.ts`, `adapters.test.ts` |
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
| C33 Reportes y dashboard | `outcomes.ts`: snapshot con `null` para dato ausente y bandera `stale`; `dashboard.ts`: renderer HTML server-side de solo lectura, escapado de todos los valores, «sin dato» para `null`, aviso de obsolescencia, previsión rotulada «no es ingreso», conversión con «sin denominador», CSP `default-src 'none'` sin `script-src` y `no-store` | PARTIAL — renderer probado; almacén de métricas y gráficas STUB | `outcomes.test.ts`, `dashboard.test.ts` |
| C34 Portal responsive, chat y Anam | `portal.ts`: página HTML responsive de solo lectura, servida con enlace firmado (HMAC + caducidad), CSP estricta y `no-store`; sin chat ni presencia | PARTIAL — chat/Anam no; enlace real no probado en navegador | `portal.test.ts` |
| C35 SDK TypeScript, Hono y tools | `client.ts`: cliente tipado sobre la API preview con validación de respuesta, timeout con reconciliación y errores del catálogo; `adapters.ts`: tools del modelo sin aprobación | PARTIAL — paquete publicable no | `client.test.ts`, `adapters.test.ts` |
| C36 Bridge de agente y eventos | `bridge.ts`: envelope de evento validado (tipo cerrado, tenant, operación, fecha) con rechazo de campos internos (`prompt`, tokens, notas); `outbox.ts`: alta idempotente por `operation_key`, conflicto si cambia el payload, un solo intento en vuelo, techo de intentos, ACK con referencia (replay y conflicto de versión), timeout → `unknown` y reconciliación por búsqueda antes de reintentar; `outbox-repository.ts`: outbox durable por tenant en `app.parent_outbox` (clave única por tenant, intento condicional a los intentos leídos, ACK con referencia, timeout y reconciliación); `HOST_BRIDGE` y el transporte no entregan | PARTIAL — transporte y ACK del padre `NOT_VERIFIED` (STUB declarado) | `integrations.test.ts`, `outbox.test.ts`, `outbox-repository.test.ts` |
| C37 Cooperación y handoff | `governance.ts`: FSM con ACK propio para reconocer y para completar | IMPLEMENTED | `governance.test.ts` |
| C38 Modelos, coste y observabilidad | `governance.ts` (reserva idempotente, reconciliación, techo) + `costs.ts` (precio por millón determinista) + tabla `budget_reservations` con clave de operación | PARTIAL — sin metering del proveedor | `governance.test.ts`, `integrations.test.ts`, `commercial-repository.test.ts` |
| C39 Privacidad y adversariales | `governance.ts` + `core.ts`: identidad/representación, plan de supresión no ejecutado, inyección de prompt | IMPLEMENTED (local) | `governance.test.ts`, `core.test.ts` |
| C40 Vertical E2E y fallos | `e2e.ts`: vertical sintético completo con 11 pasos, efectos externos en cero; `reconcileAfterTimeout` | IMPLEMENTED (local) — red real STUB | `e2e.test.ts` |
| C41 Operaciones, CI, backup y release | `operations.ts`: plan de restore (restricciones reaplicadas, jobs huérfanos bloqueados); `.github/workflows/ci.yml` ejecuta install/typecheck/test; `OPERATIONS_STATUS` declara backups/observabilidad `NOT_CONFIGURED` | PARTIAL — el workflow no se ejecutó en este host y no hay backup | `operations.test.ts` |
| C42 Aceptación, evidencia y handoff | Este informe + matriz + `HANDOFF-SHA.md` | DOCUMENTED | — |

## Auditoría transversal (2026-11-18)

Se revisó el árbol completo en dos pasadas y se corrigieron 44 defectos con
prueba. Primera: aceptación/supresión fuera de tenant, propósito de permiso no
verificado, reloj controlado por el cliente en las cotizaciones, replay de
cotizaciones y aprobaciones que devolvía la fila vieja con otro payload,
redirects de proveedor fuera del allowlist, timeouts que no cubrían el cuerpo
de la respuesta, `cache-control` ausente en respuestas autenticadas, formatos
de secreto no detectados y deriva entre los estados del dominio y los `check`
de Postgres (`0005_domain_enums.sql`). Segunda: modo de redondeo declarado en
el coste de modelo, dinero negativo en coste/presupuesto/forecast, atributos
sensibles en cualquier grafía, ciclo y `bigint` en el hash estable, medianoche
en el cálculo de offset, coste no validado en la aprobación, cursor de
importación versionado y paridad de la guarda SSRF de discovery.

El detalle, el código tocado, la prueba de cada corrección y los hallazgos
pendientes están en [AUDIT-2026-11-18.md](AUDIT-2026-11-18.md). Nada de la
auditoría acredita un proveedor ni se ejecutó contra Supabase real.

## Persistencia de efectos

`db/migrations/0003_operations.sql` añade la clave de operación a `quotes` y
`approvals` (índice único parcial por tenant), y `budget_reservations` con su
RLS. `packages/persistence/src/commercial-repository.ts` implementa los tres
repositorios sobre sesiones tenant-scoped:

- **Citas**: un `operation_key` repetido con el mismo `content_hash` devuelve la
  fila guardada (`reused: true`); con otro contenido es `IDEMPOTENCY_CONFLICT`.
  Una carrera que choque con el índice único también falla cerrado como
  conflicto, nunca duplica.
- **Aprobaciones**: guardado idempotente y revocación por `revocation_version`
  esperada; una aprobación ya revocada responde replay, una versión distinta
  responde `VERSION_CONFLICT` y un id inexistente `NOT_FOUND`.
- **Presupuesto**: reserva única por clave y tenant, con el importe comparado
  sin la escala que añade `numeric(20,8)`.

Verificado en `commercial-repository.test.ts` con PGlite: replay, conflicto,
aislamiento cross-tenant en lectura, FK compuesta contra la oportunidad de otro
tenant y revocación idempotente.

`db/migrations/0004_outbox.sql` añade `app.parent_outbox`: única por
`(tenant_id, operation_key)`, `payload_hash` sha256 obligatorio, estados
`pending | sent | acked | failed | unknown`, `attempts`, `ack_ref`, `last_error`
y un `check` que impide un `acked` sin referencia, con RLS habilitada y forzada.
`packages/persistence/src/outbox-repository.ts` implementa la misma máquina de
estados que `packages/sales/src/outbox.ts` sobre esa tabla:

- el intento se actualiza de forma condicional a los `attempts` leídos, así que
  dos workers no pueden convertir el mismo intento en entrega;
- un ACK solo cierra una entrada `sent`/`unknown`; repetirlo con la misma
  referencia es replay y con otra es `VERSION_CONFLICT`;
- un timeout deja `unknown` y bloquea el reenvío hasta que la reconciliación
  busque el evento; si no está, queda `failed` y entonces sí se permite otro
  intento, con el mismo `operation_key`.

Verificado en `outbox-repository.test.ts` (6 pruebas) con PGlite: idempotencia y
conflicto de payload, un solo intento en vuelo, ACK replay/conflicto/sin envío,
timeout y reconciliación en ambos sentidos, techo de intentos, aislamiento
cross-tenant y el `check` SQL del ACK.

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

## Superficie HTTP

Todas las rutas JSON comparten JWT Supabase + membership + scope de servidor,
cuerpo estricto (64 KiB, sin campos extra) y tenant/actor derivados del
principal. Sin `DATABASE_URL`, las rutas con efecto responden 424
`DEPENDENCY_UNAVAILABLE`: no hay almacenamiento por defecto.

**Preview (sin efecto)** — `apps/api/src/routes/commercial.ts`:

| Ruta | Scope | Qué hace |
|---|---|---|
| `POST /v1/ventas/quotes/preview` | `sales.quote:propose` | calcula totales y aplica el mandato de descuento si se envía |
| `POST /v1/ventas/approvals/preview` | `sales.approval:review` | crea el binding con el revisor verificado; rechaza un `reviewer` del cliente |
| `POST /v1/ventas/email/preview` | `sales.email:propose` | borrador sink-only con allowlist y supresión |
| `POST /v1/ventas/handoffs/transition` | `sales.handoff:propose` | transición FSM con ACK obligatorio |
| `POST /v1/ventas/imports/preview` | `sales.import:write` | duplicados, conflictos y cursor sin retroceso |

**Con efecto local, idempotente** — `apps/api/src/routes/persisted.ts`:

| Ruta | Scope | Qué hace |
|---|---|---|
| `POST /v1/ventas/quotes` | `sales.quote:propose` | calcula, aplica mandato y persiste con `content_hash`; 201 nuevo, 200 replay |
| `GET /v1/ventas/quotes/:id` | `sales.pipeline:read` | lee la cotización del tenant verificado |
| `POST /v1/ventas/approvals` | `sales.approval:review` | persiste la aprobación con el revisor verificado |
| `POST /v1/ventas/approvals/:id/revoke` | `sales.approval:review` | revoca incrementando `revocation_version`; replay idempotente |
| `GET /portal/quotes/:id?token=…` | enlace firmado | página HTML de solo lectura con CSP y `no-store` |

Ninguna ruta envía, firma, cobra ni llama a un proveedor. Las pruebas cubren el
caso correcto, la falta de scope (`CAPABILITY_NOT_GRANTED`), el tenant declarado
en el body (rechazado por esquema), el mandato excedido, la supresión, el ACK
fuera de orden, el cursor que retrocede, el replay idempotente, el conflicto de
clave, el 424 sin almacenamiento y la caducidad/manipulación del enlace del
portal.

## Stubs explícitos (fallan cerrado)

Cada hueco está declarado una sola vez en `packages/sales/src/stubs.ts`
(`CAPABILITY_STUBS`): campaña, capacidad, estado (`stub` o `not_verified`),
código de error con el que falla, archivo que lo posee y variables requeridas
(solo nombres, nunca valores). `stubs.test.ts` comprueba que los `id` son
únicos, que cada código pertenece al catálogo cerrado, que las campañas con
parte externa abierta están cubiertas y que `stubCapability(id)` lanza de
verdad. La tabla legible está en [REMAINING-STUBS.md](REMAINING-STUBS.md).

| Stub | Comportamiento | Código |
|---|---|---|
| Proveedor CRM real | gateway HTTP implementado, sin credenciales ni vendor verificado | `PROVIDER_NOT_CONFIGURED` (503) / `NOT_IMPLEMENTED` (501) |
| Proveedor de firma | verificación HMAC implementada; sin secreto ni proveedor | `PROVIDER_NOT_CONFIGURED` / `NOT_IMPLEMENTED` |
| Cobro / checkout | puerto deshabilitado | `NOT_IMPLEMENTED` |
| Chat y presencia (Anam) | no implementados; el portal es solo HTML de lectura | `PORTAL.status = "not_implemented"` |
| Entrega al agente padre | mapping validado, transporte y ACK no verificados | `HOST_BRIDGE_NOT_VERIFIED` |
| Envío de correo real | solo preview en sink | `mode: "sink_only"` |
| Calendario real | propuesta local, sin proveedor | `status: "proposed"` |
| CI, backups, observabilidad | declarados ausentes | `OPERATIONS_STATUS` |
| Supabase real, JWKS, Storage, Realtime, pooler | no ejecutado | `NOT_VERIFIED` |

## Lo que este trabajo NO hizo

- No añadió endpoints que llamen a proveedores, envíen, firmen o cobren: el
  único efecto es una fila local en Postgres.
- No ejecutó el workflow de CI en este host ni configuró backups u observabilidad.
- No abrió el portal en un navegador: se verificó con peticiones HTTP y aserción
  sobre el HTML, no con inspección visual.
- No llamó a ningún proveedor, no envió correo, no firmó, no cobró, no desplegó,
  no creó usuarios ni tocó producción.
- No modificó el repositorio padre, `main`, ni ramas de otros agentes.
- No ejecutó Supabase, Docker ni Postgres servidor: la evidencia de base de datos
  es PGlite y el adaptador `pg` sigue `NOT_VERIFIED` contra un servidor real.
- No creó interfaz de usuario navegable (dashboard servido, portal interactivo,
  inbox) ni empaquetó un SDK publicable: el renderer del dashboard y el HTML del
  portal existen y están probados como funciones, no como producto visual.
- No conectó el dashboard a un almacén de métricas ni lo publicó en una ruta:
  los datos en vivo son STUB (`REPORT_QUERY_STORE`).
- No llamó a ninguna API de fuentes: la recuperación de C13 usa `fetch`
  inyectado en las pruebas y el proveedor de búsqueda es STUB.
- No entregó ningún evento al agente padre: el outbox es determinista y el
  transporte es STUB (`HOST_BRIDGE_NOT_VERIFIED`).

## Reproducción

```bash
export PATH="$HOME/.local/bin:$PATH"   # pnpm local, sin root
pnpm install                            # EXIT=0
pnpm run typecheck                      # EXIT=0
pnpm run test                           # EXIT=0, 285 pruebas / 30 archivos
```

Cualquier gate marcado IMPLEMENTED arriba tiene su archivo de prueba en
`packages/sales/src/*.test.ts`, `packages/persistence/src/*.test.ts` o
`apps/api/src/*.test.ts`. Un PASS sin comando y salida debe tratarse como
hallazgo de auditoría.
