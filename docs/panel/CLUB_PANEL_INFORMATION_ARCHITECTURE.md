# Club Panel Information Architecture

## Alcance

Este documento aplica solo al panel de discotecas.
El panel de bares queda fuera de alcance.

## Objetivo

Ordenar los apartados del panel para que el local vea solo lo necesario y cada sección tenga una responsabilidad clara.

## Estructura propuesta

Dashboard

Operación
- Check-in
- Free pass
- Entradas
- Mesas

Gestión
- Calendario
- Fechas y promociones
- Perfil del local

Soporte
- Soporte

Métricas:
- No se toca en este bloque.
- Si existe en navegación actual, se mantiene sin cambios hasta una decisión posterior.

## Responsabilidad por apartado

### Dashboard

Resumen operativo y accesos rápidos.
No debe ser pantalla de configuración.

### Check-in

Validación de accesos en puerta.
Debe priorizar:
- escanear QR;
- búsqueda manual por nombre, email o documento;
- validar acceso con acción explícita.

No debe priorizar búsqueda por link, token o referencia como flujo visible para el local.

### Free pass

Gestión de free pass:
- crear/activar/desactivar;
- fecha o vigencia;
- cantidad/límite si aplica;
- usados y sin usar;
- acceso hacia check-in.

### Entradas

Gestión de entradas pagas:
- nombre;
- descripción;
- precio;
- stock;
- fechas donde aplica;
- activo/inactivo;
- ventas/usadas de forma resumida.

Debe evolucionar para permitir aplicar stock por rango y días de semana.
No es viable depender de configuración día por día.

### Mesas

Configuración de mesas, no CRM en esta etapa.
Debe permitir:
- tipos de mesa;
- precio referencial;
- capacidad/personas;
- descripción;
- activo/inactivo;
- link o WhatsApp.

CRM/leads queda fuera de alcance inicial salvo quick win posterior.

### Calendario

No se toca ahora.
Mantiene su función actual.

### Fechas y promociones

Gestión de:
- fechas especiales;
- noches temáticas;
- DJs invitados;
- tributos;
- promociones.

Usar el nombre “Fechas y promociones”, no “Agenda y promociones”.

### Perfil del local

Presentación pública del local.
Debe contener:
- fotos;
- descripción;
- ubicación;
- horarios;
- WhatsApp;
- Instagram;
- información pública general.

No debe duplicar configuración de entradas ni mesas.
Los bloques de “Entradas y mesas” deben moverse o quitarse cuando existan secciones propias.

### Soporte

Sección simple:
- contactar Tairet;
- reportar problema;
- guía rápida;
- WhatsApp soporte.

## Decisiones tomadas

- El panel actual se reorganiza solo para discotecas.
- Bares quedan fuera de alcance.
- Calendario no se toca.
- Métricas no se toca.
- Perfil del local no se rediseña, salvo quitar duplicación de entradas/mesas.
- Entradas debe resolver configuración por rango y días.
- Mesas será configuración, no CRM.
- Check-in debe enfocarse en puerta: scanner y búsqueda manual humana.
- Fechas y promociones será el nombre del módulo.

## Fuente de verdad por módulo

- Entradas se gestionan desde Entradas.
- Mesas se gestionan desde Mesas.
- Perfil del local no debe crear ni editar entradas/mesas.
- Perfil del local puede mostrar resumen o links hacia Entradas/Mesas, pero no duplicar configuración.
- Fechas y promociones gestiona anuncios comerciales, fechas especiales y promociones.
- Check-in solo valida accesos.

## Roles esperados

### Owner

- configura entradas;
- configura mesas;
- edita perfil;
- gestiona fechas y promociones;
- ve información operativa;
- puede validar accesos.

### Staff

- foco principal en Check-in;
- puede validar accesos;
- no debe modificar precio, stock, perfil, mesas ni promociones salvo decisión posterior.

## Principios UI

- diseño premium, oscuro y claro;
- evitar términos técnicos visibles;
- mobile-first en Check-in;
- desktop-friendly en configuración;
- botones principales con jerarquía fuerte;
- estados traducidos y accionables;
- empty states útiles;
- no saturar pantallas;
- priorizar velocidad operativa;
- cada pantalla debe responder una tarea principal.

## Mapa de rutas actuales y nombres visibles

| Ruta actual | Nombre visible propuesto | Responsabilidad |
| --- | --- | --- |
| /panel | Dashboard | Resumen |
| /panel/checkin | Check-in | Validación de accesos |
| /panel/access | Entradas | Entradas pagas y stock |
| /panel/orders | Pendiente: Accesos emitidos / historial | Listado operativo, no creación |
| /panel/calendar | Calendario | Se mantiene |
| /panel/marketing/promos | Fechas y promociones | Fechas especiales y promociones |
| /panel/profile | Perfil del local | Presentación pública |
| /panel/metrics | Métricas | No se toca |
| /panel/settings | Configuración / Soporte, según estado actual | Pendiente review |

## Criterios de aceptación por slice

- diff pequeño;
- no tocar módulos fuera de alcance;
- no duplicar responsabilidades;
- no exponer términos internos;
- mantener owner/staff;
- typecheck PASS;
- smoke manual de la pantalla tocada;
- tmp-bancard queda fuera.

## Nota sobre /panel/orders

- /panel/orders no debe seguir creciendo como pantalla partida sin propósito.
- A futuro debe definirse si será “Accesos emitidos”, historial operativo, o si se absorberá por Free pass/Entradas.
- Por ahora no se elimina sin review específico.

## Slices recomendados

1. Sidebar / naming / arquitectura visible
- Renombrar y agrupar navegación.
- No cambiar lógica fuerte.

2. Entradas por rango y días
- Aplicar stock por rango.
- Elegir días de semana.
- Evitar carga día por día.

3. Limpiar Perfil del local
- Quitar bloques de Entradas/Mesas duplicados.
- Linkear a secciones correspondientes si aplica.

4. Mesas configuración
- Crear configuración simple de mesas.

5. Check-in UX puerta
- Mejorar scanner, búsqueda manual y mensajes.

6. UI polish general
- Cards, responsive, jerarquía visual, estados vacíos y consistencia.

## Fuera de alcance

- Panel de bares.
- Bancard producción.
- Cambios SQL sin review específico.
- Rediseño completo inmediato.
- CRM de mesas.
- Métricas.
- Calendario.
- Wallet / Mis entradas.
- Offline mode.
- App nativa.

## Criterio

Antes de mejorar mucho la UI visual, el panel debe tener arquitectura clara y responsabilidades separadas.
