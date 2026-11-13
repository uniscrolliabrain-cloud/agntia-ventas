# Adaptadores y licencias

Todos NOT_IMPLEMENTED/NOT_VERIFIED en runtime. [Repos por SHA](research/repositories.json); lectura de metadatos/README y licencias selectivas, no auditoría completa. No se han clonado/instalado ni usado cuentas demo ajenas. La elección de release/digest estable queda pendiente.

| ID | Repositorio | Licencia metadata | Uso/precaución |
|---|---|---|---|
| R01 | [twentyhq/twenty](https://github.com/twentyhq/twenty/tree/f92e6d41312f3d026ef0edac532c2c6c741f28b8) | NOASSERTION | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |
| R02 | [frappe/crm](https://github.com/frappe/crm/tree/73ec05a1712909ea2ad0e631e088baa5fa3ea4a5) | AGPL-3.0 | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |
| R03 | [espocrm/espocrm](https://github.com/espocrm/espocrm/tree/aa8afc2dcab1d173d36ef7a2e27581d7d8f6712d) | AGPL-3.0 | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |
| R04 | [SuiteCRM/SuiteCRM](https://github.com/SuiteCRM/SuiteCRM/tree/be6191927d643872942a364bc5877493a6ae25a2) | AGPL-3.0 | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |
| R05 | [documenso/documenso](https://github.com/documenso/documenso/tree/1e2333d534e151578ffb05394428e2a7efea5f50) | AGPL-3.0 | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |

Twenty requiere revisar AGPL/excepción de interfaces/archivos Enterprise y paquetes MIT. Frappe CRM/EspoCRM/SuiteCRM son candidatos AGPL según metadatos; módulos, distribución y APIs se verifican individualmente. Documenso es puerto de firma optativo, no permiso de firmar ni equivalencia universal de firma electrónica.

La licencia de código no cubre automáticamente pesos/modelos, contenido de cursos, tipografías, plantillas, corpus judiciales, datos actuariales, plugins o servicios cloud. No copiar upstream por comodidad. API/proceso separado es arquitectura recomendada, no excepción jurídica universal. Leer obligaciones de modificación/distribución/servicio en red y compatibilidad antes de incorporar material.

## Registro y discovery

ProviderConnection por tenant/proyecto, endpointRef/secretRef solo servidor, versión/edición y binding remoto. No aceptar URL, base de datos, company/site/course/workspace, token o método libre desde un modelo. Bot mínimo por ámbito, rotación sin perder links y secretos externos. DNS/IP/redirect/tamaño/tiempo/egress protegidos. Public JSON minimizado, no credenciales/nombres internos innecesarios.

CapabilityReport distingue documented, verified_runtime, unknown, unsupported, forbidden y not_configured, con fecha/expiry/evidencia. Un200 con HTML/estructura errónea o empresa equivocada no es healthy. Sin permiso no se cae a admin; no crear registros reales para probar discovery. Unknown deshabilitado y advertencia útil. Cada versión/edición/modulo/rol puede invalidar el report.

## Lectura, staging y sincronización

ExternalLink por tenant/connection/model/externalId/localKind, IDs strings opacos, sourceHash/remoteVersion/mapperVersion. No mapear por nombre o posición. Import preview conserva warnings/campos pendientes/procedencia; aceptación local no fabrica revisión profesional, consentimiento o emisión remota. Repetición idéntica no duplica; cambio legítimo crea nueva revisión/conflicto según AuthorityMap.

Cursores/paginación estables con overlap si hace falta; watermark después de commit local. Barridos detectan archivado/borrado remoto sin destruir historia. Conflicto con dato revisado bloquea overwrite. Dos sistemas que reclaman autoridad por mismo campo/efecto deben acordarlo antes de bidireccionalidad, no last-write-wins silencioso.

## Escritura

Dry-run puro local; preview con diff/alcance/coste y aprobación cuando corresponda. Algunos endpoints llamados test envían o modifican estado: demostrar semántica antes de usarlos. Persistir intent/audit/key/outbox antes de HTTP; cada llamada remota tiene su transacción propia. Si el proveedor acepta y se pierde respuesta, reconciliar por referencia segura; si no existe, bloquear/escalar, no duplicar con otra key/proveedor. No delete/unlink/submit/post/execute genéricos al agente.

El piloto conserva este límite: Sin mensajes comerciales reales, alta automática de leads por scraping, firma/contrato, cobro, descuentos fuera de mandato o compromisos de entrega durante el piloto. Cotización y envío son capacidades distintas; datos públicos no prueban permiso para contactar. Un backend faltante queda explícito; un fake útil no se ofrece como conector real. La UI del proveedor puede existir para administración interna, sin ser interfaz obligatoria del cliente. Feature flags detienen nuevas operaciones sin borrar evidencia/links ni simular rollback de efectos externos.
