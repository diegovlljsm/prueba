---
id: REQ-001
titulo: Cumplimiento de contenido generado por usuarios (Apple 1.2)
estado: propuesto
prioridad: P0
epica: legal
esfuerzo: M
responsable: por-asignar
depende_de: []
bloquea: [FEAT-007]
creado: 2026-08-30
actualizado: 2026-08-30
---

## Problema

urbanFlow publica fotos subidas por usuarios. Eso la clasifica como app de
contenido generado por usuarios y la somete a la guideline 1.2 de App Store
Review, que es una de las causas más habituales de rechazo. Si estas piezas no
están implementadas en la primera entrega, la app se rechaza y se pierden
semanas en el ciclo de revisión.

No es un trámite de última hora: son funciones de producto que hay que diseñar,
construir y operar.

## Solución propuesta

Implementar las cuatro exigencias de la guideline, más el borrado de cuenta que
Apple exige por separado a toda app con registro:

1. **Filtrado previo de contenido objetable.** Lo cubre la cola de revisión
   humana (FEAT-003): ningún spot es visible antes de aprobarse. Esto ya
   satisface el requisito sin necesidad de filtro automático.
2. **Mecanismo de reporte.** Acción "Reportar" en cada spot y en cada foto, con
   respuesta en menos de 24 horas.
3. **Bloqueo de usuarios abusivos.** Acción "Bloquear" en el perfil del autor, y
   capacidad del equipo de expulsar a quien suba contenido ofensivo.
4. **Información de contacto publicada.** Correo de soporte visible en la ficha
   de la tienda y dentro de la app.
5. **Borrado de cuenta desde dentro de la app**, sin escribir a soporte.
6. **Aceptación explícita de las condiciones de uso** antes de poder publicar,
   con tolerancia cero declarada frente al contenido ofensivo.

## Alcance

**Incluye:** los seis puntos anteriores, el compromiso operativo de respuesta en
24 h y el procedimiento interno para atender un reporte.

**No incluye:** la moderación automática por modelo (ADR-003) ni la política de
privacidad (REQ-003), que van en fichas propias.

## Criterios de aceptación

- [ ] **Dado** cualquier spot publicado, **cuando** el usuario abre su detalle,
      **entonces** existe una acción "Reportar" alcanzable en un toque.
- [ ] **Dado** un reporte enviado, **cuando** pasan 24 horas, **entonces** ha
      sido revisado por una persona y el reportante recibe respuesta.
- [ ] **Dado** que un usuario bloquea a otro, **cuando** navega por la app,
      **entonces** deja de ver contenido de ese autor.
- [ ] **Dado** un contenido confirmado como ofensivo, **cuando** el equipo lo
      resuelve, **entonces** el contenido se retira y la cuenta que lo subió
      queda suspendida.
- [ ] **Dado** un usuario registrado, **cuando** entra en su cuenta,
      **entonces** puede borrarla por completo desde la app, y sus datos
      personales se eliminan o anonimizan.
- [ ] **Dado** un usuario nuevo, **cuando** intenta publicar por primera vez,
      **entonces** debe aceptar las condiciones de uso de forma explícita.
- [ ] **Dado** el envío a revisión, **cuando** se prepara la ficha de la tienda,
      **entonces** el correo de soporte figura publicado y operativo.

## Notas técnicas

- El bloqueo se aplica en el servidor, no solo en el cliente: un cliente
  modificado no debe poder ver el contenido bloqueado.
- El borrado de cuenta debe respetar los spots ya aprobados. La opción sensata
  es anonimizar la autoría en lugar de borrar el spot, y declararlo en las
  condiciones de uso para que sea legítimo (ver REQ-004).
- Conviene guardar la evidencia de cada resolución de reporte: si Apple pregunta
  cómo se gestiona la moderación, hace falta poder responder con datos.

## Riesgos y preguntas abiertas

- [ ] ¿Quién cubre la ventana de 24 horas, incluidos fines de semana? Es un
      compromiso operativo real y hay que asignarlo. → Alfredo y Diego.
- [ ] ¿Correo de soporte definitivo y en qué dominio? → pendiente del dominio.

## Trazabilidad

- Origen: revisión de App Store Review Guidelines, sección 1.2 (Safety — User
  Generated Content), 2026-08-30.
- Relacionados: [[FEAT-003]], [[FEAT-007]], [[REQ-003]], [[REQ-004]].
