# Evidencia de ejecución — fábrica Agntia Ventas

Registro de lo realmente ejecutado al implementar las campañas
`docs/execution-program/campaigns/NNN/CAMPAIGN.md`. **Un documento no es un
test; un mock no acredita un proveedor.** Este índice no sustituye al manifest:
`docs/campaigns/campaign.json` sigue siendo el programa y sus estados de gate.

## Convenciones

- `PASS`: comprobación ejecutada en este repositorio con su comando y salida.
- `FAIL`: comprobación ejecutada que falló y no está corregida.
- `PARTIAL`: parte del alcance verificada; el resto sigue pendiente.
- `BLOCKED`: depende de algo no disponible (proveedor, credencial, host).
- `NOT_VERIFIED`: no se pudo ejecutar en este entorno; se declara el motivo.

Cada informe guarda: campaña, SHA inicial, rama, archivos, tareas, comandos con
exit code, conteo de tests, gates, bloqueos y siguiente dependencia.

## Informes

| Campaña | Informe | Estado |
|---|---|---|
| VTA-C01 | [C01](C01-REPORT.md) | PARTIAL |
| VTA-C02 | [C02](C02-REPORT.md) | PARTIAL |
| VTA-C03 | [C03](C03-REPORT.md) | PASS (sin persistencia real) |
| VTA-C04 | [C04](C04-REPORT.md) | PASS (sin high-level bridge) |
| VTA-C05 | [C05](C05-REPORT.md) | PASS |
| VTA-C06 | [C06](C06-REPORT.md) | PASS (Postgres WASM; Supabase real NOT_VERIFIED) |
| VTA-C07 — C42 | [C07-C42](C07-C42-REPORT.md) | Matriz por campaña: 25 IMPLEMENTED, 10 PARTIAL, 1 DOCUMENTED |
| Stubs abiertos | [REMAINING-STUBS](REMAINING-STUBS.md) | 16 stubs declarados en `CAPABILITY_STUBS` |

## Comandos del proyecto

```bash
pnpm install
pnpm run typecheck     # tsc --noEmit en contracts, domain, identity, sales, persistence y api
pnpm run test          # vitest en los seis paquetes (249 pruebas / 29 archivos)
pnpm run dev           # API Hono en :8787 (falla cerrado sin SUPABASE_*)
```

Variables de entorno necesarias para arrancar la API:
`SUPABASE_JWT_ISSUER`, `SUPABASE_JWKS_URL`, opcional `SUPABASE_JWT_AUDIENCE`
(default `authenticated`). No se commitea ningún valor.
