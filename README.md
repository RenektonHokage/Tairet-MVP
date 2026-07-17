# Tairet MVP (tairet-mono-2)

Monorepo PNPM con backend Express+TypeScript, panel Next.js 15, y frontend B2C Vite+React. Sistema de gestión de eventos, reservas y venta de entradas para locales nocturnos.

## Quickstart

### Instalar dependencias
```bash
pnpm install
```

### Levantar servicios

**Terminal 1 - Backend API:**
```bash
pnpm -C functions/api dev
```
Puerto: típicamente `4000` si está libre (mirá el output del terminal).

**Terminal 2 - Panel B2B:**
```bash
pnpm -C apps/web-next dev
```
Puerto: típicamente `3000` o `3001` si están libres (mirá el output del terminal).

**Terminal 3 - B2C:**
```bash
pnpm -C apps/web-b2c dev
```
Puerto: típicamente `5173` si está libre (mirá el output del terminal).

## Docs

- **[AGENTS.md](AGENTS.md)** - Mapa y guardrails persistentes para agentes
- **[docs/access-core/INDEX.md](docs/access-core/INDEX.md)** - Lectura mínima y fuentes canónicas de Access Core
- **[docs/RUNBOOK.md](docs/RUNBOOK.md)** - Guía rápida para levantar servicios y verificar que todo funciona
- **[SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md)** - Baseline histórico del MVP; parcialmente superado

## Smoke tests

Ver `scripts/smoke.http` para requests de prueba compatibles con la extensión **REST Client** de VS Code.
