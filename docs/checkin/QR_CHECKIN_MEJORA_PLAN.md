QR Check-in Mejorado — Plan de implementación por fases

Objetivo

Mejorar el flujo de check-in QR del panel de discotecas para que el staff pueda escanear entradas de forma continua, con feedback inmediato en pantalla y mejor rendimiento en condiciones reales (noche, poca luz, movimiento), sin romper el flujo actual ni los contratos existentes.

Contexto actual (resumen)

El lector QR usa ZXing (BrowserQRCodeReader).

El flujo actual es single-shot:

1. activa cámara


2. detecta un QR


3. corta cámara


4. operador toca botón “Check-in”


5. recién ahí ve resultado



Esto genera fricción y baja velocidad operativa en puerta.


Problemas detectados

1. No hay escaneo continuo (se corta la cámara tras cada lectura).


2. Feedback tardío (el resultado aparece fuera del viewport y después de un click manual).


3. Errores 409 mal mapeados (casos distintos terminan como “ya usado”).


4. Sin optimización para baja luz (sin torch toggle, sin tuning de cámara/ZXing).


5. Sin dedupe robusto (riesgo de relecturas repetidas y doble check-in accidental).


6. Posible carrera multi-dispositivo (backend recomendado atomizar en fase 3 opcional).




---

Alcance

Incluye

Mejoras del flujo QR en panel/checkin para discotecas.

Escaneo continuo con validación automática.

Feedback visual inmediato.

Mejoras de usabilidad para baja luz / operación real.

Hardening progresivo (dedupe, red, resiliencia).


No incluye

Reescribir el sistema de órdenes.

Cambiar lógica de negocio de ventanas de validez (salvo mejor mapeo de mensajes).

Rediseño completo del panel.

Cambios globales de QR fuera del módulo de check-in.



---

Restricciones / No-goals

No romper el endpoint actual PATCH /panel/checkin/:token.

No romper fallback manual (input + check-in manual debe seguir existiendo).

No tocar backend en Fase 1 y Fase 2 salvo que aparezca un bug bloqueante.

Mantener compatibilidad con ZXing ya instalado (sin meter librerías nuevas innecesarias).

Evitar cambios grandes fuera del scope del módulo de check-in.



---

UX recomendada (decisión de producto)

Opción elegida: Overlay inline sobre la cámara (recomendada)

Feedback inmediato superpuesto al viewport:

Éxito (verde): “Entrada válida”

Ya usado (amarillo): “Ya utilizado”

Inválido / no encontrado (rojo)

Fuera de ventana (amarillo/rojo, texto específico)

Error de red (gris/rojo, con hint de reintento)


Por qué esta opción

Mantiene la vista del operador en el lugar correcto (la cámara).

Es el flujo más rápido para volumen alto.

Evita modales/toasts invasivos.


Complemento opcional

Un panel compacto debajo con “Último resultado” + contador de lecturas exitosas, para trazabilidad visual.



---

Fase 1 — Flujo continuo + feedback inmediato (sin romper contrato actual)

Objetivo

Eliminar la fricción principal del flujo actual:

que la cámara no se corte por cada QR

que el check-in se haga automáticamente

que el resultado se vea instantáneamente


Cambios esperados

Reemplazar decodeOnceFromVideoElement por modo continuo (decodeFromVideoDevice).

Al detectar token:

normalizar

dedupe básico

disparar check-in automáticamente


Mantener fallback manual (input + botón).

Agregar overlay de feedback sobre el viewport.

Corregir mapeo de respuestas del backend (409 no siempre es “ya usado”).


Criterios de éxito (DoD)

[ ] Cámara permanece activa entre escaneos

[ ] Check-in automático al detectar QR

[ ] Feedback visible dentro del viewport

[ ] Fallback manual operativo

[ ] No se rompe flujo actual de permisos/errores


QA manual

[ ] QR válido (no usado) → success inmediato

[ ] QR ya usado → warning correcto

[ ] QR inválido → error correcto

[ ] Token de otro local → forbidden correcto

[ ] Permiso denegado / sin cámara → estado claro

[ ] 20 scans seguidos sin salir de cámara



---

Fase 2 — Calidad de escaneo (baja luz / movimiento)

Objetivo

Mejorar la lectura del QR en condiciones reales de puerta (noche, reflejos, movimiento).

Cambios esperados

Tuning de ZXing:

TRY_HARDER

POSSIBLE_FORMATS = [QR_CODE]

delays de scan ajustados


Mejorar constraints de cámara:

facingMode: environment

resolución razonable (sin ir a extremos)


Torch toggle (solo si el dispositivo lo soporta)

Guía visual para el operador:

marco de enfoque

mensaje breve de ayuda (“acercá/alejá el QR”)



Criterios de éxito (DoD)

[ ] Mejor lectura con poca luz (comparado con hoy)

[ ] Torch visible cuando hay capability

[ ] No rompe en devices sin torch

[ ] UX clara para operador


QA manual

[ ] Android con poca luz

[ ] iPhone con poca luz

[ ] Reflejos de pantalla de celular

[ ] QR en Gmail ampliado / descargado

[ ] Distancia corta/media



---

Fase 3 — Hardening operativo (dedupe, red, estabilidad)

Objetivo

Hacer el flujo robusto para uso real con volumen y múltiples dispositivos.

Cambios esperados (Frontend)

Dedupe robusto:

token en vuelo (inFlightToken)

cooldown por token

lista corta de últimos tokens procesados


Red resiliente:

timeout explícito

retry acotado para fallos transitorios (no para errores de negocio)


Estado operativo:

offline / reconectando

prevención de doble submit



Cambios opcionales recomendados (Backend)

Atomizar update de used_at con condición used_at IS NULL

Unificar códigos de error de check-in (para mapeo más confiable en FE)


Criterios de éxito (DoD)

[ ] Relectura rápida del mismo QR no dispara doble check-in

[ ] Mejor manejo de red inestable

[ ] Menos riesgo de carrera entre dispositivos

[ ] Flujo estable bajo stress


QA manual

[ ] Relectura del mismo QR en 1–2s

[ ] 2 dispositivos escaneando el mismo QR

[ ] Latencia alta / red intermitente

[ ] 100 lecturas consecutivas



---

Riesgos y mitigaciones

Riesgo: Safari / iPhone limita capacidades

Mitigación: degradación segura (sin torch/zoom si no existe capability)

Riesgo: overlay molesta el encuadre

Mitigación: overlay compacto + auto-dismiss corto (800–1200 ms)

Riesgo: errores de negocio mal interpretados

Mitigación: normalizar payloads de backend y mapear por code/mensaje real

Riesgo: doble check-in por carrera multi-dispositivo

Mitigación: dedupe FE (fase 3) + atomización backend opcional (recomendada)


---

Decisiones pendientes (antes de implementar)

1. Sonido al escanear (beep)

Recomendación: toggle (apagado por defecto o recordar preferencia local)



2. Vibración (si dispositivo lo soporta)

Recomendación: toggle (muy útil en puerta)



3. Tiempo del overlay

Recomendación inicial:

éxito: 900 ms

usado/inválido: 1200 ms

error red: 1500 ms






---

Orden de implementación recomendado

1. Fase 1 (bloque más importante, mayor impacto UX)


2. QA real corto


3. Fase 2 (mejora de lectura en puerta)


4. QA real nocturno


5. Fase 3 (hardening)


6. Opcional backend (si quieren blindar multi-dispositivo)




---

Nota operativa

El QR llega grande por Gmail y se puede ampliar/descargar, lo cual ayuda bastante.
Aun así, el foco debe estar en:

continuidad de escaneo

feedback inmediato

lectura estable con poca luz


Eso es lo que más impacta en experiencia real de puerta.

