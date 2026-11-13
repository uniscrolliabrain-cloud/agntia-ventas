# Supabase y twins: contrato transversal

Requisito expreso del propietario: multitenancy con JWT Supabase en todos los servicios/modos, nomenclatura/linaje leídos del padre y agentes canónicos allí con twin vinculado en cada SaaS. Esta entrega no modifica la autenticación o identidad de agente.

## Principal verificable

Firma/algoritmo, issuer/audience del proyecto autorizado, exp/nbf, rotación y caché JWKS limitada. Endpoint de claves fijado por servidor, no jku/issuer libre de token no verificado. Preferir asimétrico; legacy requiere estrategia Supabase explícita sin repartir secreto de firma. JWT decodificado no es prueba. `role: authenticated` no es owner o profesional del dominio.

Conservar claims `sub`, `tenant_id`, `app_metadata.tenant_id` y contexto `tenantId`. Contrastar usuario activo/membership provisionada/suspensión y scope de recurso/campo. `user_metadata` editable no otorga autoridad; no fallback default/owner, ni tenant de body/LLM como verdad. Un claim firmado puede estar obsoleto: revalidar revocación antes de acceso sensible o efecto.

En el padre observado existen compatibilidad user_metadata y provisioning de primera membership; aquí no se adoptan como autorización suficiente ni se afirma haberlos corregido allí. El bridge deberá probar una resolución confiable. Un cambio al host se propone como documento y requiere otro encargo. Portal externo comparte esta misma policy.

## Identidad canónica y twin

Actor humano/agente conserva kind/id/tenantId y userId o roleId/runtimeId según tipo; personaId y kernelTurnId cuando aplican. AgentActor.id corresponde a runtimeId, no a persona/rol. TwinBinding nuevo del SaaS referencia esos IDs, revisión canónica, instancia local, targetTenantId, WorkOrder, capabilities, purpose, budget, issuedAt/expiresAt/revocationVersion/proofRef. No presentar canonicalAgentId inventado como campo nativo.

Especialidad propuesta: comercial. El catálogo efectivo se confirma: índice default12 y catálogo base16 son plantillas distintas, no evidencia de12 agentes/twins ejecutándose. No registrar empleados canónicos nuevos o copiar memorias default a clientes. La especialización local es versionada y scoped; no una segunda identidad soberana.

Un twin puede razonar localmente bajo mandato vigente sin llamar al padre por cada palabra. Si vence/revoca el mandato, conserva estado/historia y bloquea efectos nuevos. Workers usan identidad de servicio privada y delegación verificable originada por principal autorizado; no falsifican JWT humano ni retienen access token para colas indefinidas. Actor de origen y target/data scope no se sobreescriben entre sí. Cada job crea su contexto; AsyncLocalStorage no persiste por sí mismo en una cola durable.

## Aislamiento completo

Consultas/FKs/RLS USING/WITH CHECK y roles reales API/worker, incluido owner/BYPASSRLS/service_role. No asumir RLS con una credencial administrativa. PEP de recurso/campo independiente. Storage/URLs firmadas, Realtime, búsquedas/vectores, cache, exports, reportes y backups también aislados; namespaces visuales no son barrera. Cambiar tenant en UI revalida/vacía contexto y sesión AV.

Invitaciones/shares son verificables, limitados, caducables y revocables; identidad de canal/email/usuario no se fusiona por nombre. Visitantes o intake público usan contrato separado mínimo y antiabuso, sin membership empresarial implícita. Webhooks se autentican por firma/credencial/binding, no simulan JWT humano. Acceso de soporte operador requiere motivo/mandato/audit mínimo.

Pruebas pendientes: token de otro proyecto, alg inválido/caducado, user_metadata hostil, principalA/recursoB, colaborador sin acceso a materia/cohorte, mandato vencido en job, reanudación Anam de otro scope, caché/vector/export con datos cruzados. Un solo fallo detiene rollout, aunque el flujo funcional parezca correcto.
