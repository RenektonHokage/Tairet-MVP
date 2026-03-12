# AGENT.md — docs/panel

## Propósito

Este directorio contiene la fuente de verdad documental para iniciativas relacionadas con el panel B2B de Tairet.

Cualquier trabajo de Codex que toque el panel debe usar estos documentos para:
- entender contexto;
- registrar discovery;
- documentar decisiones;
- dejar checkpoints claros;
- guiar implementaciones por bloques.

Este `AGENT.md` define cómo debe trabajar Codex cuando la tarea afecta al panel o a `docs/panel/`.

---

## Objetivo de trabajo

Priorizar siempre:
1. menor alcance;
2. menor superficie de cambio;
3. menor riesgo;
4. máxima verificabilidad;
5. reutilización del panel real;
6. documentación clara antes y después de cada bloque.

No optimizar por “hacer más cosas”.
Optimizar por cambios pequeños, comprobables y fáciles de revisar.

---

## Flujo obligatorio

### 1) ASK / Discovery primero
Para features medianas, refactors, demo mode, arquitectura, cambios multiarchivo o iniciativas con riesgo:
- primero hacer discovery;
- inspeccionar el repo real;
- identificar punto de inserción de menor riesgo;
- comparar alternativas;
- documentar hallazgos en `docs/panel/` antes de implementar.

No pasar directo a CODE si:
- la arquitectura no está clara;
- hay múltiples alternativas viables;
- el alcance no está bien recortado;
- la tarea toca varios módulos del panel.

### 2) Documentar antes de CODE
Antes de implementar, crear o actualizar el documento correspondiente en `docs/panel/` cuando aplique.

Ejemplos:
- discovery general;
- cierre de bloque;
- checkpoint de QA;
- decisiones abiertas;
- roadmap recortado.

### 3) CODE por bloques pequeños
Implementar solo un bloque acotado por vez.
Cada bloque debe:
- tener objetivo claro;
- dejar una salida verificable;
- preservar el flujo live;
- evitar tocar módulos fuera de scope.

### 4) Cerrar bloque y documentar
Cuando un bloque quede validado:
- registrar qué se hizo;
- registrar QA manual/técnico;
- registrar límites pendientes;
- dejar el estado listo para retomar luego sin perder contexto.

---



## Reglas de alcance

### Hacer
- respetar convenciones existentes del repo;
- preferir cambios localizados;
- reutilizar componentes, layout, provider y helpers existentes;
- usar fixtures tipados si la iniciativa requiere datos demo;
- separar claramente lo implementado de lo futuro;
- dejar explícitos no-goals y restricciones.

### No hacer
- no ampliar alcance “ya que estamos”;
- no clonar paneles o páginas completas sin evidencia fuerte;
- no mezclar discovery con implementación grande en un solo paso;
- no reescribir módulos enteros si alcanza un seam más chico;
- no tocar backend, DB, seeds o auth real si la tarea fue definida como front-only;
- no meter dependencias nuevas salvo necesidad real y justificada.

---

## Restricciones operativas para este repo

### Build
No ejecutar `build` en este proyecto desde Codex.
Puede colgarse y no forma parte del flujo aprobado.

### Validación permitida por defecto
Preferir:
- inspección de diff;
- revisión de archivos;
- comandos livianos;
- `typecheck` cuando aplique.

Si una validación no puede correrse, decirlo explícitamente.

### Commits
No hacer commit salvo pedido explícito del usuario.

### Refactors
Evitar refactors amplios no relacionados.
Si durante una tarea aparece deuda técnica, mencionarla, pero no resolverla fuera del scope aprobado.

---

## Validación esperada

Cada bloque debe indicar claramente:

1. qué se cambió y por qué;
2. qué archivos fueron tocados;
3. qué validación se ejecutó;
4. qué resultado tuvo;
5. qué riesgos pendientes quedan, solo si aplica.

Siempre separar:
- hechos verificados por repo / diff / typecheck / QA;
- inferencias razonables;
- incertidumbres.

---

## Definición de terminado

Una tarea se considera terminada solo si:
- cumple el alcance exacto pedido;
- no invade módulos fuera de scope;
- deja una salida observable/verificable;
- preserva el flujo live si así fue requerido;
- deja documentación suficiente cuando el cambio lo amerita.

No se considera terminada si:
- el alcance quedó ambiguo;
- no se puede verificar el cambio;
- hay regresiones no revisadas;
- falta documentar un checkpoint importante.

---

## Criterios especiales para panel demo

Cuando la tarea esté relacionada con panel demo:
- favorecer un solo panel real, no paneles clonados;
- favorecer runtime demo controlado;
- favorecer fixtures por dominio;
- priorizar bloques read-only o semisimulados antes de módulos más pesados;
- preservar siempre el flujo live cuando el demo está apagado;
- documentar claramente qué módulos están demo-enabled y cuáles no.

---

## Uso de `docs/panel/`

Este directorio debe contener documentos claros y separados por propósito.

Ejemplos de tipos de documento válidos:
- discovery;
- cierre de bloque;
- checkpoint de QA;
- decisiones de arquitectura;
- backlog recortado;
- notas de riesgos o exclusiones.

Cada documento debe:
- decir qué cubre;
- decir qué no cubre;
- ser fácil de retomar semanas después;
- evitar ruido histórico innecesario;
- servir como fuente de verdad operativa.

---

## Estilo de respuesta esperado de Codex

Cuando responda dentro de este contexto, Codex debe:
- ser preciso;
- ser concreto;
- no inflar hallazgos;
- no asumir cosas no verificadas;
- indicar límites;
- proponer el camino más simple y seguro.

Evitar:
- sobreexplicar;
- sobredocumentar;
- abrir demasiados frentes;
- confundir roadmap futuro con alcance aprobado actual.

---

## Regla final

Si hay duda entre:
- una solución más grande pero “completa”;
- y una solución más chica, verificable y reversible;

elegir la más chica, verificable y reversible.