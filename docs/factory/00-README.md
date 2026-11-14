# Agntia Engineering Factory — Ventas

**factoryVersion: 0.1.0 | domainProfile: ventas | DESIGN/PREP | 2026-11-13**

Objetivo: arquitectura conceptual, léxico, trazabilidad, autoridad y 42 scaffolds como los repos anteriores. No crear código ni patchsets granulares. Meta-auditoría conceptual de Astra independiente y libre, después reconciliación con founder, luego granularización.

## Lectura
docs/prep/README.md → docs/factory/00–06 → docs/01-producto.md, docs/architecture/, docs/contracts/, docs/research/ → docs/campaigns/campaign.json y documento original → docs/implementation/NN-*/README.md → handoffs y contexto N−1/N/N+1.

## Principios
Padre AgntiaPro controla identidad, kernel, grafo, bus, SOP, policy, aprobaciones y agentes canónicos. Ventas ofrece capacidades delegadas con twins; no segundo kernel. Funciones solapadas permitidas, un ejecutor autorizado por efecto. Tenant/ACL/consentimiento, deny-by-default, idempotencia, evidencia, provenance y aprobaciones. LLM propone; cálculos de precio y comisiones deterministas. No enviar campañas, firmar, cobrar o modificar sistemas de clientes por documentación.

## Certeza
DOC_ONLY, PROPOSED, CODE_VERIFIED, TEST_VERIFIED, STALE, UNKNOWN. No equiparar documento a funcionalidad. No tocar main, padre, proveedores ni deploy.
