# UX simple, responsive y presencia Anam

Propuesta para Ventas y operaciones comerciales, no UI construida. Portal propio para cliente externo, superficies integrables para AgntiaPro y administración interna separada. No obligar al cliente a abrir el CRM/ERP/LMS/editor/backend. Columna derecha de chat/twin en escritorio; panel móvil accesible con contexto y controles visibles.

## Experiencia y roles

Owner ve encargos, resultados, pendientes de revisión, coste y bloqueos; especialista/revisor ve expediente/proyecto/cohorte con fuentes, revisiones y acciones permitidas; colaborador o destinatario externo solo recursos compartidos. Cambio de tenant/proyecto explícito y principal visible. Cachés, descargas, Realtime y sesión AV se revalidan; no arrastrar datos privados de una pestaña/contexto anterior.

La pantalla principal organiza: resumen del encargo, fuente original, proyección/artefacto editable, diff/propuesta, evidencia y decisión. Datos missing/stale/conflict/unverified visibles sin crear falsa certeza. El usuario puede editar borradores y ver impacto; cambio material invalida approval. Notas internas y contenido para terceros se distinguen. Mostrar propuesta, efecto aceptado, resultado confirmado e incertidumbre como estados diferentes.

Candidato sintético → aceptación humana → oportunidad → catálogo/precio vigente → quote calculada → revisión → envío a sink → receipt → reunión simulada → handoff con ACK.

Una acción sensible abre preview exacto de payload/destinatario/ámbito/versión/coste/efectos. Guardar, proponer, solicitar revisión, aprobar y ejecutar no se confunden. Doble click/refresco conserva operationKey. Error posterior al envío ofrece reconciliación/escalado, no botón de retry ciego. Un resultado profesional/acreditación/compra no se infiere de que el sistema haya respondido con tono convincente.

## Anam como presencia del agente existente

N01 documenta modalidades de persona/pipeline y uso de componentes propios. Seleccionar una que preserve runtime/autoridad canónicos del padre: twin hace trabajo bajo contratos; Anam aporta visio/voz, sin permiso por avatar. Backend emite token de sesión efímero desde JWT Supabase/ACL/TwinBinding/mandato. API key no va a browser/modelo/logs. JWT, token AV y credenciales de proveedor son distintos.

AdvisorSession limita tenant/recurso/encargo, capabilities, duración/concurrencia, budget, retention/recording policy y expiry/revocación. Callbacks/tools pasan por mismo PEP. Cambiar scope o caducar mandato detiene efectos y recrea contexto si se permite. No simular que hay humano, firma, facultad profesional o actividad de background por una cara en pantalla.

Sí hablado prepara una propuesta; en el piloto autorización sensible se confirma en UI autenticada y step-up cuando aplique. Informar IA/permisos AV; grabación desactivada hasta política/base aprobadas, alternativa de texto/subtítulos y posibilidad de corregir transcripción. No biometría/emoción para calificar personas. Si no hay plan/saldo/conexión, fallback texto conserva estado honesto.

## Accesibilidad e idiomas

ES/EN/FR en interfaz y materiales con verificación de nombres/números/fechas/unidades/citas. Traducción del UI no prueba calidad del modelo en ese idioma. Objetivo WCAG2.2AA pendiente, no certificado: teclado/foco/lectores/contraste/áreas táctiles/reduced motion y anuncios async. Móvil permite leer fuentes, editar y aprobar sin hover. Browser tests previstos con datos sintéticos: dos pestañas/cambio tenant, red lenta, revocación, reconexión AV, contenido largo y pantalla pequeña.
