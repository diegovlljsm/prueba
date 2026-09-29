# UrbanFlow — Handoff frontend → backend

Savestate del proyecto a 2026-09-01. App tipo "Waze para deporte urbano" (skate/BMX/parkour): descubrimiento de spots, eventos, rutas y comunidad.

## Cómo correrlo

```
npm install
npm run dev
```

Abre `http://localhost:3000`. El servidor Express (`server.ts`) sirve la API y hace de middleware de Vite, así que un solo `npm run dev` levanta todo (no hace falta correr frontend y backend por separado).

Las API keys reales (Google Maps, OpenRouteService) ya están en `.env` / `.env.local` — no hace falta configurar nada para correrlo. Si no tienes credenciales de Firebase Admin localmente, el servidor cae automáticamente a un fallback en memoria (`mockSpots`/`mockEvents` en `server.ts`) — verás un warning en consola pero la app funciona igual.

Otros comandos: `npm run lint` (type-check con `tsc --noEmit`, no hay test suite todavía), `npm run build` (build de producción con Vite).

## Stack

- React 19 + TypeScript + Vite 6 + Tailwind CSS 4
- Express (`server.ts`) sirviendo API REST + Vite en dev
- Firebase Auth (solo Google Sign-In, sin email/password) + Firestore vía Firebase Admin SDK, con fallback en memoria si no hay credenciales
- `@vis.gl/react-google-maps` para el mapa
- OpenRouteService para rutas reales (driving/cycling/walking) — se usó en vez de Google Directions porque esa API pide billing habilitado
- `motion` (Framer Motion) para animaciones

## Arquitectura: móvil y escritorio están separados a propósito

Por pedido explícito, el código de móvil y escritorio vive en archivos distintos para que no se mezclen:

- `src/App.tsx` — todo el estado compartido (spots, eventos, usuario, fotos/reseñas, etc.), todos los fetch/handlers, y renderiza `<MobileLayout />` o `<DesktopLayout />` según `useIsMobile()` (media query `max-width: 767px`, solo una capa monta a la vez).
- `src/mobile/MobileLayout.tsx` — toda la UI de la versión app (bottom sheet, bottom nav, etc.)
- `src/desktop/DesktopLayout.tsx` — toda la UI de la versión escritorio (sidebar, nav vertical, etc.)
- `src/components/` — piezas compartidas por ambas capas (SpotDetail, EventDetail, AddSpotForm, AuthScreen, EditProfileForm, RouteView, SkaterLogo)
- `src/constants.tsx` / `src/constants.shared.ts` — datos estáticos y mock compartidos
- `src/types.ts` — tipos compartidos (Spot, UrbanEvent, etc.)

Si vas a tocar UI, respeta esta separación: un cambio "solo para móvil" no debería tocar `DesktopLayout.tsx` y viceversa. La lógica de datos (fetches, handlers) vive en `App.tsx` y sí es compartida.

## Qué es real vs. maqueta visual

Todo lo marcado como MOCK está comentado in-line en el código explicando qué falta. Resumen:

### Real, conectado a backend
- Spots y eventos (CRUD, `server.ts` + Firestore/fallback en memoria)
- Fotos y reseñas de spots y eventos, con agregación de rating promedio (`withRatings()` en `server.ts`)
- Auth con Google (Firebase Auth) + modo invitado
- Rutas reales (OpenRouteService) y geolocalización
- Panel de administración (aprobar/rechazar clips, borrar spots/eventos) — solo visible para admin
- Preferencia de unidades (km/mi) en el menú de Configuración — es el único toggle de Configuración que hace algo real (cambia las distancias mostradas)

### Maqueta visual / mock (sin backend todavía)
- **Perfil**: estadísticas (spots visitados, reseñas, favoritos) → `MOCK_PROFILE_STATS` en `src/constants.tsx`
- **Desafíos** (gamificación): desafíos activos/completados, progreso, XP → `MOCK_CHALLENGES_ACTIVE` / `MOCK_CHALLENGES_COMPLETED` en `src/constants.tsx`. No hay tabla de desafíos, contador de progreso por usuario, ni sistema de XP/recompensas.
- **Favoritos**: lista de spots favoritos → `MOCK_USER_FAVORITES` en `src/constants.tsx`. No hay persistencia de favoritos.
- **Editar perfil** (`src/components/EditProfileForm.tsx`): nombre/ciudad/foto/disciplina/bio — nada se guarda, el botón "Guardar cambios" solo muestra un alert. Foto sube una preview local (FileReader) pero no hay storage. "Eliminar mi cuenta" no borra nada.
- **Configuración**: "Tipo de mapa", "Notificaciones", "Cuenta privada" son toggles visuales sin efecto real ni persistencia.
- Botones "Centro de ayuda" y algunos placeholders muestran un `alert('Próximamente...')` en vez de navegar a algo real.

Busca `MOCK_` y `Próximamente` en el código para encontrar todos los puntos exactos.

## Limitaciones conocidas

- **Cuota de Google Maps**: la key de demo tiene un límite diario que se agota fácil con testing intensivo (error "Maps Demo Key limit reached" en consola). Es un límite de Google, no un bug. Se resuelve habilitando billing (capa gratuita) en Google Cloud Console, o esperando a que resetee.
- **Login solo con Google**: el formulario de email/contraseña en `AuthScreen.tsx` es visual (inputs deshabilitados, "Próximamente") — no hay lógica de auth por contraseña.

## Prioridades sugeridas para el backend

1. Persistencia de perfil de usuario (nombre, ciudad, foto, disciplina, bio) — reemplaza `EditProfileForm.tsx`
2. Favoritos reales (guardar/quitar spot como favorito, endpoint que liste los del usuario)
3. Sistema de desafíos/XP — tabla de desafíos, progreso por usuario, ledger de recompensas
4. Estadísticas reales de perfil (spots visitados, reseñas escritas, favoritos) agregadas desde datos existentes (reviews, favoritos)

Cualquier duda sobre por qué algo está hecho de una forma específica, revisa los comentarios in-line — se dejaron a propósito para este handoff.
