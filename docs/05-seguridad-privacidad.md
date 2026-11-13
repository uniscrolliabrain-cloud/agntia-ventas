# Seguridad, privacidad y ámbito profesional

Controles de diseño, no dictamen universal. Fuentes L01–L03/Dxx consultadas selectivamente; revisar rol/uso/territorio/fecha/contrato antes del piloto. No se hereda cumplimiento de Supabase, del proveedor de modelos o de un backend open source. Autenticación no prueba representación, competencia profesional o derecho sobre un documento.

La presión comercial no permite engaño, insistencia tras oposición, promesas no soportadas ni selección de personas por vulnerabilidades. Sin mensajes comerciales reales, alta automática de leads por scraping, firma/contrato, cobro, descuentos fuera de mandato o compromisos de entrega durante el piloto. Cotización y envío son capacidades distintas; datos públicos no prueban permiso para contactar.

## Acceso y datos

JWT Supabase con firma/issuer/audience/tiempos, usuario/membership y scope de recurso/campo. Deny-by-default y sin owner/default al fallar una dependencia. No user_metadata editable como autoridad, ni tenant/actor/roles del prompt. Dos tenants pueden contener nombres/emails/archivos parecidos sin compartir acceso. Dentro del tenant también hay materias/cohortes/proyectos restringidos, y el operador necesita mandato explícito para trabajar.

RLS/consultas/FKs compuestas, roles reales API/workers y revisión de BYPASSRLS/service_role. Tests también en Storage/URL firmadas, Realtime, search/vector/cache/report/export y backups. Cambiar scope cierra contexto y revalida jobs/sesiones. Una credencial técnica global no sustituye política. No datos privados en etiquetas de logs o métricas que agregan clientes.

## Entrada hostil y efectos

HTML/XML/SVG/CSV/documentos/web/tool results son datos, no instrucciones. Desactivar contenido activo no aprobado, proteger contra CSV formula injection, MIME falso, archivos enormes/corruptos y path traversal. Descarga backend con endpoint/egress/DNS/IP/redirect/límites controlados, nunca URL arbitraria del modelo o credenciales en query. Antivirus/cuarentena y sanitización según tipo; scan ausente se informa y puede bloquear ingesta sensible.

El modelo no ejecuta shell/SQL/macros/HTTP genérico. Calcular en DSL/funciones allowlist y sandbox sin secretos/canal cuando haga falta. La revisión automática ayuda pero no aprueba el efecto. Payload/fuente/rights/policy/version/tenant/recipient/coste/caducidad vinculados al approval. Revocación y dato stale se comprueban antes de nuevo efecto. No reenviar automáticamente tras timeout, ni borrar historia para aparentar cancelación.

## Finalidad, confidencialidad y derechos

Registrar propósito/base y permisos específicos de acceso/compartición, fuentes y representación. Consentimiento no es casilla universal, ni uso de archivo o grabación autoriza entrenamiento. No consolidar memorias privadas, perfilar atributos sensibles o analizar biometría/emociones para decisiones. El contexto LLM se limita al encargo; retrieval autorizado antes y después de búsqueda. Modelo/retención/región y subencargados se eligen por política, no solo por precio.

PrivacyRequest exige identidad/representación/alcance y revisión. Export con terceros minimizados y acceso/links caducables; supresión/restricción considera retención/hold/reglas aplicables y no se ejecuta por chat sin proceso. Separar payload personal con retención de refs auditables. Índices/resúmenes/memoria/backends reciben cambios con ACK o pendiente claro. Restore reaplica restricciones y no resucita datos o permisos. Backups cifrados con claves/control separados y prueba de recuperación.

## Amenazas y pruebas

| Amenaza | Control | Prueba prevista |
|---|---|---|
| BOLA entre tenants/recursos | Principal, scope, FK/RLS y ACL | ActorA pide objeto/job/archivoB |
| Suplantación de actor/profesional | Mandato/representación/revisor verificados | Nombre de avatar correcto sin permiso |
| Prompt injection indirecta | Datos sin autoridad, tools nominadas | Documento ordena exportar secretos |
| SSRF/exfiltración | EndpointRef/egress/redirect/DNS y tamaños | URL metadata y redirect a red privada |
| Doble efecto distribuido | Intent durable y reconciliación | Aceptación remota perdida antes de ACK |
| Decisión sin evidencia | Fuentes/revisión/estado protected | Dato faltante o inferencia presentada fact |

Cero fugas, secretos centinela, approvals fabricadas y duplicados de replay en gates críticos. Cualquier fallo detiene. La comunicación de incidente y obligaciones se evalúan por responsables humanos con hechos, no una plantilla automática que garantiza conformidad. No usar datos de clientes reales para demostrar seguridad.
