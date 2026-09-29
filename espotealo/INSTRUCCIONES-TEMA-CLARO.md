# Auditoría y fix: consistencia del tema claro/oscuro en UrbanFlow

Contexto para quien ejecute esto (Claude Code): este es un hand-off de diseño → código,
complementario a `HANDOFF.md` en la raíz del proyecto. Léelo primero si no lo has hecho —
explica el stack, la separación mobile/desktop, y qué partes de la app son reales vs. mock.

**Estado (revisado sobre el savestate del 2026-09-04):** las Prioridades 1 a 4 de abajo
ya están resueltas y verificadas por grep/hash de imagen — quedan documentadas para
contexto histórico, marcadas ✅. Quedan dos hallazgos nuevos, más chicos, al final
(Prioridad 5 y 6).

## Prioridad 1 — ✅ Resuelto: `DesktopLayout.tsx` ya tiene tema claro

Pasó de 0 a 308 referencias `light:` (de 1187 líneas, ~96% de las líneas con clases de
color ya tienen su contraparte `light:` — mismo nivel que `SpotDetail.tsx` o
`EventDetail.tsx`). Verificado con:

```bash
cd src && for f in $(find . -name "*.tsx"); do
  c=$(grep -o "light:" "$f" | wc -l); l=$(wc -l < "$f"); echo "$c light: refs | $l lines | $f";
done | sort -t'|' -k2 -rn
```

## Prioridad 2 — ✅ Resuelto: ya no hay control de tema duplicado en mobile

En `MobileLayout.tsx` ya solo queda una fila ("Tema", con switch) en Configuración; la
fila "Tipo de mapa" fue eliminada de ahí. Ojo: en `DesktopLayout.tsx` la fila equivalente
sigue llamándose "Tipo de mapa" — no es un duplicado (es la única fila de tema en esa
pantalla), pero ver Prioridad 6 más abajo sobre el nombre distinto entre plataformas.

## Prioridad 3 — ✅ Resuelto: logo del tema claro recoloreado

`public/logo-light-wordmark.png` ahora es dominante en `#dd4726` (antes ~`#c92c14`) —
verificado por muestreo de píxeles. Ya coincide con el acento usado en el resto de la UI.
Pendiente solo avisar que la copia en `manual de marca/logo -tema-claro@3x.png` (fuera del
repo) sigue con el color viejo, si es que también se quiere actualizar ahí.

## Prioridad 4 — ✅ Resuelto: comentario de `index.css` actualizado

El bloque de comentario en `src/index.css` ya describe correctamente que el radio de
esquina es el mismo en ambos temas y que el control se llama "Tema" (ya no menciona
esquinas rectas ni "Tipo de mapa").

## Prioridad 5 — Badge "Spot Validado" sin color de tema claro (desktop)

En `src/desktop/DesktopLayout.tsx`, líneas 875-876, el ícono `ShieldCheck` y el texto
"Spot Validado" usan `text-[#a3ff12]` sin ningún `light:` al lado — es el único lugar de
todo el archivo con ese patrón. Este badge no existe en `MobileLayout.tsx` (parece
exclusivo de escritorio), así que no hay una versión mobile de la que copiar el ajuste
correcto. Agrégale `light:text-[#dd4726]` a ambas clases para que sea consistente con el
resto de los acentos verdes/naranjos.

## Prioridad 6 — Nombre distinto para el mismo control entre mobile y desktop

En Configuración, la fila que cambia `mapTypePreference` se llama "Tema" en
`MobileLayout.tsx` y "Tipo de mapa" en `DesktopLayout.tsx` — mismo estado, mismo
`setMapTypePreference`, dos etiquetas distintas de cara al usuario. No es un bug
funcional, pero conviene unificar el texto (sugerencia: "Tema" en ambas, ya que es más
claro que es toda la apariencia de la app y no solo el mapa) para que alguien que use la
app en mobile y desktop no piense que son cosas distintas.

## Verificación al terminar

1. `npm run lint` (type-check, no hay test suite).
2. `npm run dev`, y en el navegador: activar "Tema Claro" desde Configuración y revisar
   cada pantalla en ancho mobile (<768px) y en ancho desktop (≥768px) — Mapa, Spots,
   Eventos, Perfil, Nuevo Spot, Auth, y la vista de Ruta. Comparar contra las referencias
   visuales en la carpeta `para-claude-design/` del proyecto de diseño (son mockups
   estáticos hechos aparte, no screenshots de la app — sirven como referencia de
   intención, no como verdad absoluta si algo ya evolucionó en el código).
3. Confirmar visualmente el badge "Spot Validado" en tema claro después del fix de la
   Prioridad 5.
