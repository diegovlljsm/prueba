---
id: FEAT-003
titulo: Cola de revisión y aprobación interna
estado: propuesto
prioridad: P0
epica: moderacion
esfuerzo: L
responsable: por-asignar
depende_de: [FEAT-001, FEAT-010]
bloquea: [FEAT-002, FEAT-006, FEAT-011]
creado: 2026-08-30
actualizado: 2026-08-30
---

## Problema

La curaduría es el diferencial de urbanFlow: un mapa colaborativo sin filtro se
llena de ruido y deja de servir. Además, las tiendas exigen que exista un
mecanismo real de moderación con respuesta en 24 horas (REQ-001), así que esta
pieza no es opcional ni aplazable a después del lanzamiento.

El riesgo operativo es el otro lado: si revisar un spot cuesta cinco minutos, el
equipo interno abandona la cola en la primera semana y el producto se atasca.

## Solución propuesta

Una cola de trabajo en el backoffice donde cada spot pendiente se resuelve con
una decisión y, como mucho, un motivo. El objetivo operativo es **menos de 30
segundos por spot**.

El moderador ve en una sola pantalla: las fotos a tamaño grande, el pin sobre el
mapa con vista de satélite, los datos declarados, quién lo subió y su historial,
y —si lo hay— el spot cercano que podría ser el mismo.

Tres decisiones posibles:

- **Aprobar** — pasa a `aprobado`, entra en el mapa público, se avisa al autor.
- **Rechazar** — exige elegir un motivo de una lista cerrada y pasa a
  `rechazado`. El autor recibe el motivo concreto y puede corregir y reenviar.
- **Marcar como duplicado** — se enlaza con el spot existente y el autor recibe
  el enlace al que ya estaba publicado.

## Alcance

**Incluye:** la cola priorizada, la pantalla de revisión, las tres decisiones,
los motivos de rechazo cerrados, el registro de auditoría de quién decidió qué y
cuándo, y los roles de moderador y administrador.

**No incluye:** el moderador automático previo (ADR-003), la gestión de reportes
de contenido ya publicado (FEAT-007), ni las métricas de moderación.

## Criterios de aceptación

- [ ] **Dado** un spot en `en_revision`, **cuando** el moderador lo aprueba,
      **entonces** pasa a `aprobado`, se registran `aprobado_por` y
      `aprobado_en`, y aparece en el mapa público en menos de 60 s.
- [ ] **Dado** un rechazo, **cuando** el moderador no elige motivo, **entonces**
      el sistema no permite completar la acción.
- [ ] **Dado** un spot rechazado, **cuando** el autor abre "Mis spots",
      **entonces** ve el motivo concreto y un botón para corregir y reenviar.
- [ ] **Dado** que dos moderadores abren el mismo spot, **cuando** uno decide,
      **entonces** el otro ve que ya fue resuelto y por quién, sin poder
      sobrescribir la decisión.
- [ ] **Dado** un spot con un candidato a duplicado, **cuando** se abre la
      revisión, **entonces** ambos se muestran lado a lado con la distancia en
      metros.
- [ ] **Dado** cualquier cambio de estado, **cuando** ocurre, **entonces** queda
      una fila inmutable en el registro de auditoría.
- [ ] **Dado** el objetivo operativo, **cuando** se mide sobre 20 spots reales,
      **entonces** la mediana de tiempo por decisión es inferior a 30 s.

## Notas técnicas

- **Orden de la cola:** más antiguo primero, salvo que el autor tenga historial
  de rechazos, en cuyo caso baja de prioridad. Evita que un usuario abusivo
  monopolice la atención del equipo.
- **Bloqueo optimista:** columna `revisando_por` con expiración de 5 minutos,
  para que dos moderadores no dupliquen trabajo sin bloquear la cola si uno
  cierra el navegador.
- **Auditoría:** tabla `spot_eventos` de solo inserción (`spot_id`, `actor_id`,
  `accion`, `motivo`, `creado_en`). Es la prueba ante una reclamación y ante la
  tienda.
- **Motivos de rechazo (lista cerrada inicial):** foto ilegible · no es un spot
  deportivo · ubicación incorrecta · propiedad privada sin permiso · contenido
  inapropiado · duplicado · datos insuficientes.

## Riesgos y preguntas abiertas

- [ ] ¿Quién modera y con qué disponibilidad? Las 24 h de respuesta que exige
      Apple son un compromiso operativo real. → Alfredo y Diego.
- [ ] ¿Se avisa al autor por push, por correo o por ambos? → FEAT-011.
- [ ] ¿Hay aprobación automática para usuarios con historial impecable?
      Reduce carga, pero abre una vía de abuso. → decisión posterior con datos.

## Trazabilidad

- Origen: definición inicial del producto, 2026-08-30.
- Relacionados: [[FEAT-001]], [[FEAT-007]], [[FEAT-008]], [[FEAT-010]],
  [[REQ-001]].
