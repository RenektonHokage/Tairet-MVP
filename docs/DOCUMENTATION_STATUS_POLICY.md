# DOCUMENTATION_STATUS_POLICY

## 1. Propósito del documento

Esta política define una convención simple para estados documentales en `docs/**`.

Su objetivo es:

- reducir ruido en revisiones humanas y con IA;
- distinguir fuentes operativas primarias de contexto histórico;
- conservar trazabilidad sin borrar documentos útiles;
- evitar que docs viejos compitan con docs vivos más nuevos.

## 2. Por qué existe esta convención

El repo ya mezcla varios tipos de documentación:

- docs vivos de arquitectura, operación, seguridad y producción;
- auditorías vigentes o parcialmente vigentes;
- discoveries fechados;
- checkpoints;
- cierres de bloques;
- snapshots históricos.

Sin una convención mínima, un documento útil pero viejo puede leerse como fuente actual por error.

La regla de esta política es pragmática:

- no etiquetar todo;
- priorizar claridad sobre burocracia;
- marcar primero los docs con más riesgo de ruido.

## 3. Estados documentales

| Estado | Qué significa | Cuándo usarlo | ¿Puede ser fuente operativa primaria? | Qué debe hacer el lector |
| --- | --- | --- | --- | --- |
| `Vivo` | documento vigente, mantenido y utilizable dentro de su scope | cuando sigue siendo la referencia actual del tema | Sí, si no compite con un reemplazo más nuevo para el mismo propósito | usarlo como base principal y contrastarlo con código/runtime cuando corresponda |
| `Requiere revalidación` | documento útil, pero insuficiente por sí solo para decidir | cuando depende de un corte temporal, runtime, working tree, QA o estado de deploy | No por sí solo | usarlo como insumo secundario y revalidarlo contra docs vivos, código o entorno |
| `Histórico` | contexto preservado, checkpoint o snapshot de una etapa anterior | cuando conserva valor de trazabilidad, pero ya no guía operación actual | No | usarlo como contexto o referencia de origen, no como base operativa |
| `Superado` | documento reemplazado por uno o más docs más nuevos | cuando su propósito ya quedó cubierto mejor en otra documentación vigente | No | no usarlo para decidir; seguir los documentos de reemplazo |

## 4. Cómo interpretar cada estado

- `Vivo` no significa perfecto ni libre de drift. Significa que sigue siendo el mejor punto de entrada para ese tema.
- `Requiere revalidación` no significa “descartar”. Significa “no usar solo”.
- `Histórico` se conserva por trazabilidad, reconstrucción de contexto o decisiones pasadas.
- `Superado` se conserva porque todavía puede explicar de dónde se viene, pero no debe competir con la fuente actual.

Regla práctica:

- si un documento fue reencuadrado por otros docs más nuevos, deja de ser fuente primaria;
- si un documento depende del working tree observado o de una corrida específica, tiende a `Requiere revalidación`;
- si un documento ya se autodeclara snapshot/checkpoint/cierre de bloque, tiende a `Histórico`.

## 5. Qué es fuente operativa primaria

Un documento es fuente operativa primaria cuando:

- está `Vivo`;
- cubre un scope actual y claro;
- no tiene un reemplazo más nuevo para ese mismo propósito;
- no depende de un corte runtime o de una observación puntual ya envejecida.

Puede convivir con drifts internos. Eso no lo invalida automáticamente.

Deja de ser fuente operativa primaria cuando:

- el propio repo lo reencuadra como histórico, snapshot, parcial o viejo;
- hay documentos posteriores que cubren mejor el mismo propósito;
- su valor depende de un contexto fechado que hoy ya no está cerrado.

Regla adicional:

- los `AGENT.md` son guía de trabajo y criterio metodológico; no son evidencia primaria del sistema, independientemente de su estado documental.

## 6. Aplicación inicial recomendada en el repo

Aplicación inicial prudente:

- crear esta política como índice central;
- agregar headers solo en los docs con mayor riesgo de inducir lectura errónea;
- no etiquetar en esta etapa todos los docs vivos;
- usar la clasificación inicial siguiente como referencia de trabajo.

### Clasificación inicial

| Estado | Documentos o familias | Lectura recomendada |
| --- | --- | --- |
| `Vivo` | `docs/production/**`, `docs/operations/**`, `docs/security/**`, `docs/architecture/**`, `docs/RUNBOOK.md`, `docs/audits/STATUS.md`, `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`, `docs/audits/HARDENING_ROADMAP.md`, `docs/audits/CONTRATOS_CONGELADOS_V1.md`, `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md` | base operativa actual por tema |
| `Requiere revalidación` | `docs/audits/BASELINE_FUNCIONAL_V1.md`, `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md`, `docs/audits/SMOKE_TESTS_V1.md`, `docs/landing/LANDING_DISCOVERY.md` | usar con contraste contra código, docs vivos o runtime |
| `Histórico` | `docs/audits/TAIRET_TECH_AUDIT_MVP.md`, `docs/checkpoint/HORARIOS_ROLLOUT_CHECKPOINT_2026-02-21.md`, `docs/panel/PANEL_DEMO_DISCOVERY.md`, `docs/panel/PANEL_DEMO_BLOQUE_1_CIERRE.md`, `docs/panel/PANEL_DEMO_BLOQUE_3_ORDERS_DISCOTECA_CIERRE.md`, `docs/panel/PANEL_DEMO_UI_POLISH_RESERVAS_ORDERS_CIERRE.md` | contexto o trazabilidad; no base operativa |
| `Superado` | `docs/docs/CHECKLIST_MVP_PANEL.md` | conservar por trazabilidad, no usar para decisiones actuales |

## 7. Lista inicial de docs que conviene marcar o revalidar

### Conviene marcar con header ahora

- `docs/docs/CHECKLIST_MVP_PANEL.md`
  porque hoy compite con docs más nuevos y además conserva formato de copy/paste.
- `docs/landing/LANDING_DISCOVERY.md`
  porque es un discovery fechado y dependiente del working tree observado.
- `docs/panel/PANEL_DEMO_DISCOVERY.md`
  porque el estado operativo actual del demo ya quedó mejor resumido en `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`.

### Conviene clasificar, pero no tocar todavía

- `docs/audits/TAIRET_TECH_AUDIT_MVP.md`
  ya se autodeclara histórico / snapshot y no necesita header adicional en esta etapa.
- `docs/checkpoint/HORARIOS_ROLLOUT_CHECKPOINT_2026-02-21.md`
  su propio título ya reduce ambigüedad; alcanza con clasificarlo aquí por ahora.
- `docs/audits/BASELINE_FUNCIONAL_V1.md`, `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md`, `docs/audits/SMOKE_TESTS_V1.md`
  siguen siendo útiles, pero su valor depende del corte en que fueron escritos o corridos; conviene revalidarlos antes de futuras decisiones.

### Formato corto estándar para headers futuros

```md
> Estado documental: ...
> Fuente operativa primaria: Sí/No
> Usar para: ...
> Ver también: ...
```

## 8. Mantenimiento futuro

- no agregar headers a todos los docs vivos;
- priorizar headers en docs históricos, superados o que requieren revalidación;
- cuando cambie el estado de un documento, actualizar primero esta política y luego el header si aplica;
- si un documento nuevo reemplaza claramente a otro, marcar el viejo como `Superado` en vez de borrarlo;
- si un documento mezcla partes útiles con partes envejecidas y no tiene reemplazo claro, preferir `Requiere revalidación` antes que `Superado`.
