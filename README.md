# Tairet Mono-2

Monorepo PNPM para el MVP de Tairet - Sistema de gestión de eventos y reservas.

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query + react-hook-form + zod
- **Backend**: Express + TypeScript
- **Base de datos**: Supabase (PostgreSQL con RLS)
- **Analytics**: PostHog (producto) + GA4 (marketing)
- **Observabilidad**: Sentry
- **Zona horaria**: America/Asuncion
- **Moneda**: PYG

## MVP

El MVP incluye las siguientes piezas:

1. **Gestión de locales** - Crear y gestionar locales/venues
2. **Promociones** - Sistema de promos con imágenes y fechas
3. **Reservas (bares)** - Reservas con estado "en_revision"
4. **Venta de entradas** - Órdenes con precio fijo por local
5. **Check-in manual** - Marcar entradas como usadas (sin QR en MVP)
6. **Métricas básicas** - KPIs: vistas, clics WhatsApp, reservas, ventas
7. **Tracking de eventos** - PostHog para eventos de producto
8. **Emails** - Confirmación de reservas y compras (stub)
9. **Panel B2B** - Dashboard con KPIs para locales
10. **Landing B2C** - Página pública para usuarios finales

## Estructura del Monorepo

```
tairet-mono-2/
├── apps/
│   └── web-next/          # Frontend Next.js
├── functions/
│   └── api/               # Backend Express
├── packages/
│   ├── types/             # Tipos compartidos (Zod schemas)
│   └── ui/                # Componentes UI compartidos
├── infra/
│   └── sql/               # Schema, RLS y seed SQL para Supabase
└── .devcontainer/         # DevContainer para VS Code
```

## Cómo correr

### Prerequisitos

- Node.js 18+
- pnpm 10+
- Supabase (proyecto configurado)

### Instalación

```bash
# Instalar dependencias de todos los workspaces
pnpm install
```

### Desarrollo

#### Frontend (Next.js)

```bash
cd apps/web-next
pnpm dev
```

El frontend estará disponible en `http://localhost:3000`

#### Backend (Express)

```bash
cd functions/api
pnpm dev
```

El backend estará disponible en `http://localhost:4000`

### Build

```bash
# Build todos los paquetes
pnpm build

# Build específico
pnpm -C apps/web-next build
pnpm -C functions/api build
```

## Variables de Entorno

Copia los archivos `.env.example` y completa con tus valores:

- **Frontend**: `apps/web-next/.env.example` → `apps/web-next/.env`
- **Backend**: `functions/api/.env.example` → `functions/api/.env`

Ver los archivos `.env.example` para la lista completa de variables requeridas.

## Setup de Supabase

1. Crear proyecto en Supabase
2. Ejecutar scripts SQL en orden:
   - `infra/sql/schema.sql` - Crear tablas
   - `infra/sql/rls.sql` - Configurar RLS
   - `infra/sql/seed.sql` - Datos de prueba (opcional)

## Convenciones

### Commits

Usar [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `docs:` Documentación
- `refactor:` Refactorización
- `chore:` Tareas de mantenimiento

### Rutas

- **B2C (público)**: `/app/(public)/*`
- **B2B (panel)**: `/app/(panel)/*`

### Tipos

- Usar tipos de `@tairet/types` cuando sea posible
- Validar con Zod en backend y formularios

### Feature Flags

Usar `lib/flags.ts` en frontend para ocultar módulos no-MVP.

### Reglas del Proyecto

Ver `.cursor/rules.yaml` para reglas detalladas:
- No inventar APIs ni tablas
- Máximo 400 líneas por archivo
- RLS multi-tenant estricto
- Idempotencia en callbacks de pago
- Sin QR en MVP (check-in manual)

## Scripts Disponibles

```bash
# Raíz
pnpm build          # Build todos los paquetes
pnpm lint           # Lint todos los paquetes
pnpm typecheck      # Typecheck todos los paquetes

# Frontend
pnpm -C apps/web-next dev
pnpm -C apps/web-next build

# Backend
pnpm -C functions/api dev
pnpm -C functions/api build
```

## DevContainer

El proyecto incluye un DevContainer para VS Code:
1. Abrir en VS Code
2. Reabrir en contenedor
3. El contenedor configura automáticamente Node.js 22 y pnpm 10

## Licencia

Privado

