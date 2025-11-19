# CHECKLIST MVP – Panel B2B Tairet

Fecha: 2025-11-XX  
Repo: `tairet-mono-2` (`Tairet-MVP` en GitHub)  
Branch: `main` (commit con mensaje: `feat: reservas bares completas y auth B2B en panel`)

---

## 1. Objetivo del panel B2B

El panel B2B permite a los dueños de locales:

- Ver KPIs básicos (vistas, clics, reservas, entradas, revenue).
- Gestionar reservas de bares (crear, confirmar, cancelar).
- Gestionar promociones y ver la promo más vista.
- Ver actividad reciente (timeline corto).
- Acceder de forma segura con login (Auth B2B + multi-tenant).

---

## 2. Cómo correr el panel en local

### Backend (API Express)

```bash
cd functions/api
pnpm dev
