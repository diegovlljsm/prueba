---
name: frontend-urbanflow
description: Construir la app móvil de urbanFlow (React Native + Expo) respetando la maqueta de Diego — sistema de tokens, componentes del mapa, flujo de captura de spot en 4 pasos, estados de moderación visibles para el autor, manejo de imágenes y accesibilidad. Úsala al crear o modificar cualquier pantalla, componente, navegación o estilo de la app móvil, y antes de proponer una librería de UI o de mapas.
---

# Frontend de urbanFlow

> **Estado: base técnica cerrada, capa visual pendiente de calibrar.**
> Las secciones marcadas con 🎨 dependen del archivo de maqueta de Diego. Hasta
> que ese archivo esté en `docs/diseno/`, usa los valores provisionales que hay
> aquí, márcalos en el código con `// TODO(maqueta)` y **no** los des por
> definitivos en ninguna revisión.

## 1. La app es un mapa, no una lista con un mapa dentro

Toda decisión de UI se subordina a esto. El mapa ocupa la pantalla completa
desde el arranque; la lista, los filtros y el detalle son capas encima. Si una
propuesta obliga al usuario a salir del mapa para hacer algo frecuente, está
mal planteada.

Consecuencias prácticas:

- **El detalle del spot es un bottom sheet**, no una pantalla nueva. El usuario
  no pierde el contexto geográfico y puede arrastrarlo para volver al mapa.
  Tres alturas: asomo (nombre + foto + distancia), media (info completa),
  completa (galería y cómo llegar).
- **Los filtros son chips horizontales sobre el mapa**, no un modal. Filtrar por
  deporte es la acción más repetida de la app y un modal la penaliza.
- **El botón de subir spot es un FAB persistente.** Es la acción que sostiene el
  producto; no se esconde en un menú.

## 2. Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | Expo (SDK managed) + React Native | Diego viene de frontend web; Expo elimina la mayor parte del trabajo nativo y EAS compila para iOS sin depender de un Mac disponible |
| Navegación | Expo Router | Rutas por archivos, el modelo mental más cercano a Next.js |
| Mapa | `@rnmapbox/maps` sobre MapLibre | Estilos totalmente personalizables — imprescindible si la maqueta tiene identidad propia. El SDK de Google Maps no permite alejarse de su estética ni de su tarifa |
| Estado servidor | TanStack Query | Caché, reintentos y revalidación del viewport sin escribir un reducer |
| Estado local | Zustand | Filtros activos y borrador de subida. Nada más |
| Formularios | React Hook Form + Zod | El mismo esquema Zod valida en cliente y en backend |
| Estilos | StyleSheet + tokens en TS | Sin Tailwind/NativeWind: la maqueta tiene identidad propia y una capa de utilidades genéricas empuja hacia lo genérico |

**No añadas una librería de componentes** (Paper, UI Kitten, Tamagui). Traen una
opinión visual que peleará con la maqueta y obligan a sobrescribir más de lo que
ahorran. Los componentes se escriben a mano sobre los tokens.

## 3. 🎨 Tokens — provisionales hasta tener la maqueta

Un único archivo `src/theme/tokens.ts` como fuente de verdad. Ningún color,
tamaño ni radio literal dentro de un componente; si hace falta uno nuevo, se
añade al token y se avisa a Diego.

```ts
// TODO(maqueta): sustituir por los valores exportados del archivo de Diego.
export const colores = {
  fondo:      "#0E0E10", // provisional: base oscura, el mapa nocturno domina
  superficie: "#1A1A1E",
  borde:      "#2A2A30",
  texto:      "#F2F2F0",
  textoTenue: "#9A9AA0",
  acento:     "#D6FF3F", // provisional
  peligro:    "#FF4D3D",
  exito:      "#3DDC84",
} as const;

export const espaciado = { xs: 4, s: 8, m: 16, l: 24, xl: 40 } as const;
export const radio = { s: 6, m: 12, l: 20, pastilla: 999 } as const;
```

**Modo claro y oscuro**: la maqueta manda. Si Diego entregó un solo modo, se
implementa ese y se fuerza con `userInterfaceStyle` en `app.json` — un modo
claro improvisado sobre una maqueta oscura siempre se ve peor que no tenerlo.

## 4. 🎨 Tipografía

La fuente de la maqueta se empaqueta con la app vía `expo-font`; no se carga de
red. Define como mucho cuatro roles (display, título, cuerpo, etiqueta) y una
escala fija. En React Native no hay herencia de fuente: cada texto la declara,
así que el componente `Texto` con prop `variante` es obligatorio y el `Text`
crudo de React Native queda prohibido fuera de él.

## 5. El flujo de captura, paso a paso

Cuatro pasos, con progreso visible y **borrador persistido en cada uno**. Alguien
va a perder cobertura en mitad de la subida; que no pierda la foto.

1. **Foto** — cámara o galería, mínimo una, máximo cinco. Se comprime en el
   dispositivo antes de subir (lado largo 2000 px, JPEG calidad 0.8): sube en
   segundos con datos móviles en vez de en minutos.
2. **Ubicación** — mapa con el pin ya colocado desde GPS o EXIF, arrastrable
   para corregir. Muestra la precisión de forma honesta ("±12 m"). Ver la skill
   `geolocalizacion` para el detalle de fuentes y permisos.
3. **Datos** — nombre, deportes (multiselección), tipo de acceso, descripción
   opcional. Nada más: cada campo extra baja la tasa de finalización.
4. **Envío** — la subida corre en segundo plano con `expo-task-manager`, con
   reintento. El usuario recupera el mapa de inmediato.

## 6. Estados de moderación: díselos al autor

El spot no aparece en el mapa público hasta que el equipo lo aprueba, y ese
silencio es la peor experiencia posible si no se explica. En "Mis spots" cada
uno muestra su estado con forma propia, no solo con color:

| Estado | Cómo se ve | Qué lee el autor |
|---|---|---|
| `en_revision` | Pastilla neutra con reloj | "En revisión — normalmente menos de 24 h" |
| `aprobado` | Pastilla de éxito con check | "Publicado — ya aparece en el mapa" |
| `rechazado` | Pastilla de peligro con el motivo | Motivo concreto y botón "Corregir y reenviar" |
| `posible_duplicado` | Pastilla de aviso | "Puede que este spot ya exista" + enlace al existente |

Un rechazo sin motivo concreto quema justo al usuario que más te interesa: el
que sube contenido.

## 7. Requisitos que la app debe cumplir sí o sí

Vienen de las tiendas y no son negociables (ver `docs/requerimientos/`):

- **Reportar contenido** accesible desde cada spot y cada foto.
- **Bloquear usuario** desde el perfil del autor.
- **Borrar la cuenta** desde dentro de la app, sin escribir a soporte. Apple lo
  exige y es motivo de rechazo automático.
- **Enlaces visibles** a términos y política de privacidad.
- **Inicio de sesión con Apple** obligatorio si se ofrece Google o Facebook.

## 8. Rendimiento en el teléfono de verdad

- Marcadores del mapa: nunca más de ~150 vistas de React a la vez. Por encima de
  eso, clustering desde el servidor (ver `geolocalizacion`) o capa de símbolos
  nativa. Es la diferencia entre 60 fps y una app que "va lenta".
- Imágenes con `expo-image`, con `placeholder` blurhash y `recyclingKey` en
  listas. Nunca el `Image` de React Native para fotos remotas.
- La consulta del viewport va con *debounce* de 300 ms desde que el mapa se
  detiene. Sin él, un paneo son cuarenta peticiones.
- Prueba en un Android de gama media, no en el simulador de iOS. Es el
  dispositivo del usuario real de esta app.

## 9. Accesibilidad — mínimo exigible

`accessibilityLabel` en todo control sin texto (el FAB, los iconos del mapa),
área táctil de 44×44 pt como mínimo, contraste AA sobre el fondo de la maqueta
—si el acento no llega, se ajusta con Diego, no se ignora— y respeto a
`prefers-reduced-motion` vía `AccessibilityInfo.isReduceMotionEnabled` en las
transiciones del bottom sheet.

## 10. Antes de dar por buena una pantalla

- [ ] Cero literales de color, tamaño o radio fuera de `tokens.ts`.
- [ ] Estados de carga, vacío y error resueltos (los tres, no solo el feliz).
- [ ] Probada sin permiso de ubicación concedido.
- [ ] Probada sin conexión.
- [ ] Textos revisados: en español, sin jerga de sistema ("no pudimos subir tu
      foto, la guardamos y lo reintentamos" y no "error 500").
