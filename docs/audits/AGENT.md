# AGENTS.md — TAIRET

## 1) Propósito

Este archivo define las reglas persistentes de trabajo para cualquier agente que lea, analice, documente o modifique el repositorio de Tairet.

Su objetivo es:

* reducir ruido en los prompts
* mantener consistencia entre fases ASK y CODE
* evitar suposiciones y retrabajo
* proteger contratos y flujos sensibles
* asegurar que la capa documental guíe cualquier cambio técnico

Este archivo **no reemplaza** los documentos de auditoría o hardening.
Los complementa como reglas operativas del agente.

---

## 2) Fuente de verdad obligatoria

La prioridad de verdad operativa es siempre:

1. **Código del repositorio**
2. **Runtime / entorno**, solo cuando el código no alcanza para confirmar el comportamiento real
3. **Input humano**, solo para:

   * negocio
   * riesgo aceptado
   * comportamiento esperado
   * prioridad operativa

### Regla obligatoria

Todo lo que no pueda demostrarse con código o runtime debe marcarse como:

* **Requiere validación**

No usar documentación vieja como fuente primaria.

---

## 3) Regla ASK vs CODE

### ASK

ASK significa trabajo de:

* discovery
* extracción de verdad desde código
* contratos
* baseline
* validaciones pendientes
* matriz de riesgos
* smoke tests
* roadmap
* criterios de no-breaking

#### En ASK:

* no implementar
* no tocar código de producto
* no presentar fixes como si ya estuvieran aprobados
* no inferir comportamiento runtime sin evidencia
* no cerrar contratos que sigan abiertos

### CODE

CODE significa trabajo de:

* implementación
* edición real de archivos dentro del alcance permitido
* cambios concretos con límites explícitos
* ejecución con validación

#### En CODE:

* no redefinir contratos sin ASK previo suficiente
* no tocar más superficie de la autorizada
* no mezclar varias fases sensibles en una misma intervención
* no romper contratos ya establecidos
* no expandir alcance sin justificación documental

---

## 4) Regla de fases sensibles

Trabajar **una fase sensible por vez**.

No mezclar en la misma intervención:

* refactor estructural de `panel.ts`
* hardening SQL / RLS
* hardening delicado de endpoints públicos
* cambios grandes de auth
* cambios de check-in / export junto con refactor amplio
* cambios múltiples sobre superficies cuyos contratos aún no estén suficientemente cerrados

Si un bloque depende de contratos, smoke tests o comportamiento runtime todavía no suficientemente confirmados, corresponde primero **ASK**, no **CODE**.

---

## 5) Regla de no-breaking

En fases tempranas o sensibles, no romper sin justificación explícita estos flujos:

* `/public/orders?email`
* `MisEntradas`
* auth del panel
* reservas del panel
* check-in
* export CSV
* rutas protegidas críticas
* contratos visibles consumidos por la UI actual

Si un cambio puede afectar alguno de esos flujos, debe existir soporte previo suficiente, como por ejemplo:

* contrato congelado suficiente
* smoke test del bloque
* clasificación de riesgo
* criterio de salida del bloque

---

## 6) Uso obligatorio de la capa documental

Antes de abrir una tarea ASK o CODE sensible, revisar y respetar estos documentos vigentes en `docs/audits/`:

* `CONTRATOS_CONGELADOS_V1.md`
* `BASELINE_FUNCIONAL_V1.md`
* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
* `HARDENING_ROADMAP.md`
* `STATUS.md`

### Regla

Si hay contradicción entre un prompt y estos documentos, el agente debe:

1. marcar la contradicción
2. no asumir
3. pedir o proponer corrección documental antes de tocar código, si corresponde

---

## 7) Regla de alcance

Cuando una tarea tenga alcance limitado, el agente debe respetarlo estrictamente.

### Si el alcance dice “solo docs”:

* no tocar código de producto
* no editar archivos fuera de los permitidos
* no meter fixes

### Si el alcance dice “solo un bloque”:

* no expandir a otros bloques
* no convertir la tarea en una reescritura del roadmap
* no arrastrar cambios estructurales innecesarios

### Si el alcance dice “sin implementación”:

* no producir cambios CODE
* no convertir el análisis en solución aplicada

---

## 8) Regla de validación

Si algo depende de runtime, el agente debe decirlo explícitamente.

Ejemplos típicos de **Requiere validación**, salvo prueba suficiente:

* explotabilidad real de una superficie XSS
* impacto real de un límite backend
* suficiencia real del logout
* comportamiento real de RLS según credenciales y entorno
* comportamiento real con datos históricos

La evidencia estática por sí sola no alcanza para afirmar comportamiento operativo real.

---

## 9) Regla de actualización documental

Si una extracción ASK aclara mejor un contrato, un riesgo o un baseline, el agente debe proponer actualización de los docs base afectados antes de seguir abriendo nuevos bloques sensibles.

Orden preferido:

1. extraer verdad
2. consolidar docs base
3. seguir con el siguiente ASK
4. recién después pasar a CODE del bloque correspondiente

No acumular hallazgos importantes sin consolidarlos en la fuente documental de verdad.

---

## 10) Cómo responder y trabajar

El agente debe:

* no inventar contratos
* no inventar consumidores
* no inventar comportamiento runtime
* no declarar algo como “cerrado” si sigue abierto documentalmente
* separar con claridad:

  * **confirmado por código**
  * **no romper**
  * **requiere validación**
* citar evidencia por archivo/línea cuando haga afirmaciones contractuales relevantes

Si la evidencia es parcial, debe decirlo explícitamente.

---

## 11) Regla para prompts

Los prompts deben:

* ser específicos
* declarar alcance
* separar ASK y CODE
* indicar archivos permitidos cuando corresponda
* indicar archivos prohibidos cuando corresponda
* evitar repetir innecesariamente reglas ya cubiertas por este `AGENTS.md`

Aun así, si una restricción crítica aplica a una tarea puntual, debe repetirse en el prompt.

Ejemplos:

* `no tocar código`
* `solo editar estos docs`
* `no mezclar con RLS`
* `no implementar`

---

## 12) Qué no es este archivo

Este archivo no es:

* un roadmap técnico
* una auditoría
* un contrato funcional del producto
* una lista de hallazgos
* un changelog
* una especificación de negocio

Es un **marco operativo persistente para el agente**.

---

## 13) Regla final

Si hay duda entre:

* avanzar más rápido con inferencias, o
* avanzar más lento pero con evidencia,

el agente debe elegir:

* **evidencia primero**

Si algo no se puede demostrar, debe quedar explícitamente como:

* **Requiere validación**
