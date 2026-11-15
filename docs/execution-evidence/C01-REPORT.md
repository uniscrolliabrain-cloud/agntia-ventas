# VTA-C01 — Baseline, fuentes y alcance

**Estado: PARTIAL. Pruebas de producto de esta campaña: 0 (es documental).**
Fecha: 2026-11-15. Rama: `impl/factory-c01-c05`.
SHA inicial congelado: `3e9ae1c8bc28b3a37741eb36a77c1235e523e7b8` (main tras
`docs(FreeBuff): reconciliar fabrica integral 42 campañas`).

## Baseline real medido

| Comprobación | Resultado |
|---|---|
| Archivos rastreados por git | 174 |
| Código de aplicación (`.ts/.tsx/.js/.py`) | 0 antes de esta campaña |
| `package.json` / lockfile / CI | ausentes antes de esta campaña |
| Ramas remotas | `main`, `docs/factory-prep-v1-20261113`, `docs/ultragranular-complete-program-20261114` |
| Tags / releases | ninguno |
| Manifest | 42 campañas, 294 tareas, 84 gates, todo `NOT_STARTED`/`NOT_EXECUTED` |
| Pruebas de producto previas | 0 |

`origin/main` estaba por delante del worktree local: se hizo fast-forward de
`adcf65c` a `3e9ae1c` antes de escribir nada, sin tocar ramas ajenas ni `main`.

## Tareas

- **T01 — congelar fuentes y autoridad: PASS.** SHA congelado, instrucciones
  locales leídas (`AGENTS.md`, `FreeBuff/HANDOFF-RECONCILIADO-42-CAMPANAS.md`,
  `docs/execution-program/*`), padre referenciado por SHA
  `54b8d5407a8576459448c4d059a877297d18ca7a` y **no modificado**.
- **T02–T06** — se ejecutan donde pertenecen (C02 autoridad, C03 identidad, C04
  twins, C05 DTOs). No se declaran hechas aquí.
- **T07 — evidencia: PASS para el alcance documental de T01.**

## Gates

- **Invariante «no modificar `agente` ni convertir documentos en pruebas
  pasadas»: PASS (documental).** No hay escritura al padre; ningún documento se
  cuenta como test.
- **Gate fail-closed:** se verifica en C03/C05 con pruebas ejecutadas, no aquí.

## Bloqueos y pendientes

- **`BLOCKED` — Postgres/RLS real:** `docker info` devuelve *permission denied*
  sobre `/var/run/docker.sock` en este entorno. Toda prueba de RLS, Storage,
  Realtime o migraciones queda `NOT_VERIFIED` hasta la campaña C06 en un
  entorno con base de datos.
- **`NOT_VERIFIED` — baseline del padre:** se conserva el SHA documentado; no se
  releyó el repositorio padre ni se ejecutó su suite (fuera de alcance).

## Siguiente dependencia

C02 (autoridad por dominio y contrato SaaS).
