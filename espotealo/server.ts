import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { requireAdmin, requireAuth, optionalAuth, adminDb } from "./serverAuth";
import { FieldValue } from "firebase-admin/firestore";
import { validateBody, validateIdParam, spotCreateSchema, eventCreateSchema, videoCreateSchema, photoCreateSchema, reviewCreateSchema, eventPhotoCreateSchema, eventReviewCreateSchema, profileUpdateSchema, visitCreateSchema, postCreateSchema, postCommentCreateSchema } from "./serverSchemas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const spotsCol = adminDb.collection("spots");
const eventsCol = adminDb.collection("events");
const videosCol = adminDb.collection("videos");
const photosCol = adminDb.collection("photos");
const reviewsCol = adminDb.collection("reviews");
const eventPhotosCol = adminDb.collection("eventPhotos");
const eventReviewsCol = adminDb.collection("eventReviews");
const usersCol = adminDb.collection("users");
const visitsCol = adminDb.collection("visits");
const postsCol = adminDb.collection("posts");
const postCommentsCol = adminDb.collection("postComments");
const postLikesCol = adminDb.collection("postLikes");
const attendeesCol = adminDb.collection("eventAttendees");

// Meters of GPS slack allowed for a "Marcar visita" check-in to count -
// generous enough for typical phone GPS drift (often 20-50m in a city)
// without letting someone check in from across town.
const VISIT_RADIUS_METERS = 150;

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Seed initial events once, if the collection is empty.
async function seedEventsIfEmpty() {
  try {
    const snapshot = await eventsCol.limit(1).get();
    if (!snapshot.empty) return;

    const seedEvents = [
      {
        title: "Urban Jam 2026",
        description: "Competencia de skate y BMX abierta a todo público. Premios en efectivo y música en vivo.",
        date: "2026-04-15T10:00:00Z",
        location_name: "Parque de los Reyes",
        lat: -33.4292,
        lng: -70.6600,
        category: "jam",
      },
      {
        title: "Taller de Parkour Básico",
        description: "Aprende los fundamentos del parkour con instructores certificados. Trae ropa cómoda y agua.",
        date: "2026-03-25T16:00:00Z",
        location_name: "Plaza de la Ciudadanía",
        lat: -33.4460,
        lng: -70.6515,
        category: "workshop",
      },
      {
        title: "Best Trick Contest",
        description: "El mejor truco en la baranda de 8 escalones se lleva el pozo. Inscripción gratuita.",
        date: "2026-05-02T14:00:00Z",
        location_name: "Escaleras del Museo",
        lat: -33.4350,
        lng: -70.6400,
        category: "contest",
      },
    ];

    const batch = adminDb.batch();
    for (const event of seedEvents) {
      batch.set(eventsCol.doc(), { ...event, createdAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
    console.log(`Seeded ${seedEvents.length} events into Firestore.`);
  } catch (err) {
    console.warn("Firestore seed skipped (using in-memory fallback for local development):", (err as Error).message);
  }
}

function docWithId<T extends FirebaseFirestore.DocumentData>(
  doc: FirebaseFirestore.QueryDocumentSnapshot<T> | FirebaseFirestore.DocumentSnapshot<T>
) {
  return { id: doc.id, ...doc.data() };
}

async function startServer() {
  await seedEventsIfEmpty();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  const mockSpots = [
    {
      id: "spot-1",
      name: "Parque Bustamante Skatepark",
      description: "Skatepark público con bowls, barandas, planos inclinados y cajones. Muy buen ambiente.",
      lat: -33.4428,
      lng: -70.6335,
      category: "skate",
      marker_color: "#ef4444",
      show_label: true,
      image_url: "/spots/parque-bustamante-skatepark.jpeg",
      location_name: "Providencia, Santiago",
      floor_quality: "Excelente",
      obstacles: "Bowls, Rails, Ledges, Stairs",
      open_hours: "Lunes a Domingo, 7:00 AM - 9:00 PM",
      spot_type: "park",
      features: ["Bowls", "Ledges", "Stairs"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-2",
      name: "Parque Los Reyes Skatepark",
      description: "Uno de los skateparks más grandes de Santiago. Zonas de street y bowl profesional.",
      lat: -33.4312,
      lng: -70.6621,
      category: "skate",
      marker_color: "#3b82f6",
      show_label: true,
      image_url: "/spots/parque-de-los-reyes.jpeg",
      location_name: "Santiago Centro",
      floor_quality: "Muy bueno",
      obstacles: "Bowl profundo, Eurogap, Hubbas",
      open_hours: "Lunes a Domingo, 6:00 AM - 10:00 PM",
      spot_type: "park",
      features: ["Bowls"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-3",
      name: "Plaza de la Ciudadanía",
      description: "Espacio amplio de concreto liso, ideal para practicar trucos de flat, líneas y saltos.",
      lat: -33.4440,
      lng: -70.6536,
      category: "bmx",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/plaza-ciudadania.jpg",
      location_name: "Santiago Centro",
      floor_quality: "Excelente",
      obstacles: "Flatground, Gradas",
      open_hours: "Lunes a Domingo, 24 horas",
      spot_type: "street",
      features: ["Smooth Concrete"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-4",
      name: "Skatepark Parque O'Higgins",
      description: "Skatepark dentro de uno de los parques más grandes de Santiago, en pleno Santiago Centro. Fácil acceso por el Metro Parque O'Higgins.",
      lat: -33.4636217,
      lng: -70.6573441,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/parque-ohiggins.avif",
      location_name: "Parque O'Higgins, Santiago Centro",
      floor_quality: null,
      obstacles: null,
      open_hours: "Lunes a Domingo, desde las 9:00 AM",
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-5",
      name: "Skatepark Parque Araucano",
      description: "El primer skatepark gratuito de Las Condes, inaugurado en 2013. Cerca de 3.000 m² de circuito street al aire libre.",
      lat: -33.4014718,
      lng: -70.5702692,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-araucano.jpeg",
      location_name: "Parque Araucano, Las Condes",
      floor_quality: null,
      obstacles: "Street",
      open_hours: "Lunes a Domingo, 9:00 AM - 9:00 PM",
      spot_type: "street",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-6",
      name: "Skatepark Padre Hurtado",
      description: "Streetpark de cerca de 3.000 m² que combina street y bowls: un bowl grande con coping de piscina, otro tipo piscina, y uno menos profundo ideal para aprender. El sector street tiene escaleras, barandas, hubbas, muros, planos inclinados y quarters.",
      lat: -33.4278094,
      lng: -70.5385721,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-padre-hurtado.jpeg",
      location_name: "Av. Padre Hurtado Sur, Las Condes",
      floor_quality: null,
      obstacles: "Bowls, Street: escaleras, barandas, hubbas, muros, planos inclinados, quarters",
      open_hours: "Lunes a Domingo, 9:00 AM - 9:00 PM",
      spot_type: "bowl",
      features: ["Bowls", "Stairs"],
      createdAt: new Date().toISOString(),
    },
    // ---------------------------------------------------------------------
    // Catastro nacional (spot-7 a spot-28): skateparks de regiones fuera de
    // Santiago, tomados de un catastro investigado por el usuario (documento
    // Word, septiembre 2026). Ninguna fuente entregaba coordenadas exactas
    // salvo Antofagasta (Pablo Neruda) y Concepción (Parque Ecuador) -
    // el resto se geocodificó a partir de la dirección/nombre de lugar vía
    // OpenStreetMap/Nominatim (gratis, sin key) para evitar inventar
    // coordenadas. Varias resuelven a un parque/calle/barrio aproximado en
    // vez del pin exacto del skatepark (el catastro original no daba más
    // precisión) - floor_quality/obstacles/open_hours se dejan en null
    // porque no hay dato verificado, no se inventaron. No se incluyeron los
    // recintos que el catastro no pudo confirmar que existan (Arica -
    // Gonzalo Cerda, San Carlos, Victoria, La Unión, Puerto Aysén) ni los de
    // existencia incierta (Chillán, Temuco), por pedido del usuario.
    // ---------------------------------------------------------------------
    {
      id: "spot-7",
      name: "Skatepark Chinchorro",
      description: "Skatepark operativo junto a la piscina municipal, sector Playa Chinchorro. Hay además un skatepark nuevo en construcción en el Parque Centenario (2ª etapa), con entrega estimada 2025-2026.",
      lat: -18.4542190,
      lng: -70.3023231,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Arica, Arica y Parinacota",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-8",
      name: "Skatepark de Playa Brava",
      description: "Skatepark operativo, con reposición completa inaugurada en diciembre de 2025.",
      lat: -20.2479147,
      lng: -70.1394501,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Iquique, Tarapacá",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-9",
      name: "Skatepark de Alto Hospicio",
      description: "Skatepark operativo en el sector Plaza Las Américas.",
      lat: -20.2943385,
      lng: -70.1059887,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Alto Hospicio, Tarapacá",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-10",
      name: "Skatepark Pablo Neruda",
      description: "Skatepark operativo en Plaza Pablo Neruda, con reportes de vandalismo/daños en 2025 y posterior reapertura.",
      lat: -23.6486,
      lng: -70.3900,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Antofagasta, Antofagasta",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-11",
      name: "Skatepark Las Almejas",
      description: "Skatepark operativo dentro del Parque Las Almejas, remodelado e inaugurado en 2026.",
      lat: -23.6728708,
      lng: -70.4112737,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Antofagasta, Antofagasta",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-12",
      name: "Skatepark El Palomar",
      description: "Skatepark operativo en el sector El Palomar, con eventos activos en 2025.",
      lat: -27.3833494,
      lng: -70.3318479,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Copiapó, Atacama",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-13",
      name: "Skatepark Parque Schneider",
      description: "Zona skate/BMX dentro del Parque Schneider, remodelada tras los aluviones de 2015.",
      lat: -27.3760621,
      lng: -70.3220473,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Copiapó, Atacama",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-14",
      name: "Skatepark Parque Espejo de Agua",
      description: "Skatepark operativo desde 2013 en el sector Las Compañías, dentro del Parque Espejo del Sol.",
      lat: -29.8640917,
      lng: -71.2384292,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/parque-espejo-agua.jpg",
      location_name: "La Serena, Coquimbo",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-15",
      name: "Skatepark Peñuelas",
      description: "Skatepark operativo desde 2012 en el sector Peñuelas, borde costero.",
      lat: -29.9536298,
      lng: -71.3014832,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-penuelas.jpg",
      location_name: "Coquimbo, Coquimbo",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-16",
      name: "Skatepark Sausalito",
      description: "Skatepark operativo desde 2013, junto a la Laguna Sausalito.",
      lat: -33.0143494,
      lng: -71.5350741,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-sausalito.jpg",
      location_name: "Viña del Mar, Valparaíso",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-17",
      name: "Skatepark de Quintero",
      description: "Skatepark operativo desde 2015 en el sector Loncura, borde costero.",
      lat: -32.7861696,
      lng: -71.5080585,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-quintero.jpg",
      location_name: "Quintero, Valparaíso",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-18",
      name: "Skatepark de Rancagua",
      description: "Skatepark comunal operativo dentro del Complejo Deportivo Patricio Mekis.",
      lat: -34.1649105,
      lng: -70.7439203,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-rancagua-mekis.jpg",
      location_name: "Rancagua, O'Higgins",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-19",
      name: "Skatepark de San Fernando",
      description: "Skatepark remodelado, existencia confirmada en el sector Villa Magisterio (dirección exacta no verificable en las fuentes consultadas).",
      lat: -34.5811088,
      lng: -70.9948370,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-san-fernando.jpg",
      location_name: "San Fernando, O'Higgins",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-20",
      name: "Skatepark Alameda de Talca",
      description: "Skatepark operativo sobre la Alameda de Talca, cerca de 30 Oriente con 3 Norte.",
      lat: -35.4216665,
      lng: -71.6655326,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-alameda-talca.jpg",
      location_name: "Talca, Maule",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-21",
      name: "Skatepark Parque Cerro Condell",
      description: "Skatepark de alto estándar, inaugurado en septiembre de 2024 dentro del Parque Cerro Condell.",
      lat: -34.9800557,
      lng: -71.2295476,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-cerro-condell.jpg",
      location_name: "Curicó, Maule",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-22",
      name: "Skatepark Parque Ecuador",
      description: "Skatepark operativo desde 2011, uno de los más grandes del sur de Chile.",
      lat: -36.834522,
      lng: -73.054243,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Concepción, Biobío",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-23",
      name: "Skatepark de San Pedro de la Paz",
      description: "Skatepark operativo, reabierto en enero de 2025 tras un período cerrado. Borde de la Laguna Grande, cerca del Anfiteatro Municipal.",
      lat: -36.8582813,
      lng: -73.1102870,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "San Pedro de la Paz, Biobío",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-24",
      name: "Skatepark de Valdivia",
      description: "Skatepark operativo en el Parque Krahmer, en proceso de rediseño/reposición participativo desde 2023.",
      lat: -39.8335519,
      lng: -73.2249616,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Valdivia, Los Ríos",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-25",
      name: "Skatepark Parque Costanera",
      description: "Skatepark operativo dentro del Parque Costanera, con reclamos de mantención reportados en 2023.",
      lat: -41.4768751,
      lng: -72.9486554,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Puerto Montt, Los Lagos",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-26",
      name: "Skatepark Parque Chuyaca",
      description: "Skatepark operativo desde 2018, descrito como el más grande del sur de Chile.",
      lat: -40.5750802,
      lng: -73.1029830,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Osorno, Los Lagos",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-27",
      name: "Skatepark de Punta Arenas",
      description: "Recinto pequeño, operativo.",
      lat: -53.1516165,
      lng: -70.9042670,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Punta Arenas, Magallanes",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    {
      id: "spot-28",
      name: "Skatepark Plaza de los Vientos",
      description: "Skatepark al aire libre, operativo desde 2014, en la costanera de Puerto Natales.",
      lat: -51.7318125,
      lng: -72.5133004,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: null,
      location_name: "Puerto Natales, Magallanes",
      floor_quality: null,
      obstacles: null,
      open_hours: null,
      spot_type: "park",
      createdAt: new Date().toISOString(),
    },
    // Agregado aparte del catastro nacional (no estaba en el documento Word
    // ni tenía fotos propias): dirección confirmada por búsqueda (Av.
    // Recoleta #2774, esquina Muñoz Gamero, frente a la Municipalidad de
    // Recoleta - fuente: patineta.net), geocodificada con Nominatim.
    {
      id: "spot-29",
      name: "Skateplaza San Alberto",
      description: "Skateplaza 100% street frente a la Municipalidad de Recoleta, con piso de losetas y línea de fierros bajos a altos rematando en un hip con pasamanos.",
      lat: -33.4020792,
      lng: -70.6432464,
      category: "skate",
      marker_color: "#10b981",
      show_label: true,
      image_url: "/spots/skatepark-san-alberto.jpg",
      location_name: "Av. Recoleta 2774, Recoleta, Santiago",
      floor_quality: "Losetas cerámicas, piso plano",
      obstacles: "5 módulos de concreto, 2 fierros de deslizar, hip con pasamanos, low to high",
      open_hours: null,
      spot_type: "street",
      createdAt: new Date().toISOString(),
    },
  ];

  // Tomados de "Informe: Deportes Urbanos en Chile 2026-2027" (investigado
  // por el usuario, sept. 2026). Coordenadas geocodificadas por dirección
  // real vía Nominatim, igual que el catastro de skateparks - nunca
  // inventadas. `available: false` marca eventos ya pasados o sin fecha
  // oficial confirmada todavía (se agregan igual, con `unavailable_reason`
  // explicando por qué, en vez de omitirlos). La mayoría son de Chile, pero
  // event-13 (World Skate Games ASU26) es en Asunción, Paraguay - se
  // incluyó a pedido del usuario aunque quede fuera del mapa de Chile.
  // Quedan fuera del informe Urban World Series (no especifica sede local)
  // y Under Park (academia real en Ñuñoa, pero sin dirección verificable
  // en fuentes abiertas) - no se les fabricó una ubicación.
  //
  // event-14 (CicloRecreoVía Viña del Mar) se agregó después, a partir de
  // fotos reales que subió el usuario (carpeta eventos/) - no estaba en el
  // informe original. Esas mismas fotos también sirvieron para poner
  // image_url real a events 1, 2, 3, 5, 6, 8 y 13 (antes sin foto) y para
  // corregir la ubicación de event-3 (era "Peñaflor", el flyer oficial
  // dice "Parque Peñalolén").
  const mockEvents = [
    {
      id: "event-1",
      title: "Red Bull Road The Gap 2026",
      description: "La \"pateada\" más grande de Chile: miles de skaters recorren las calles de Santiago desde Escuela Militar hasta Parque O'Higgins. Gratuita y abierta a toda la comunidad skater.",
      date: "2026-06-21T10:00:00",
      location_name: "Escuela Militar, Las Condes (hasta Parque O'Higgins)",
      lat: -33.4134817,
      lng: -70.5826796,
      category: "jam",
      image_url: "/events/road-the-gap.jpg",
      available: false,
      unavailable_reason: "Ya se realizó la edición 2026. Próxima fecha esperada: 21 de junio de 2027 (por confirmar).",
    },
    {
      id: "event-2",
      title: "Campeonato Nacional BMX Freestyle 2026",
      description: "Competencia oficial organizada en el Parque Estadio Nacional, con inscripciones, bases y guía técnica publicadas por Bicineta.",
      date: "2026-07-11T10:00:00",
      location_name: "Parque Estadio Nacional, Ñuñoa",
      lat: -33.4662544,
      lng: -70.6106926,
      category: "contest",
      image_url: "/events/campeonato-bmx-freestyle.jpg",
      available: false,
      unavailable_reason: "Ya se realizó. A la espera del calendario 2027 de FEDENACICH.",
    },
    {
      id: "event-3",
      title: "Copa Chile BMX Racing - Rounds 7 y 8",
      // Ubicación corregida: el flyer oficial 2026 (foto del usuario) confirma
      // "Parque Peñalolén, Santiago", no "Peñaflor" como tenía anotado antes.
      description: "Fechas 7 y 8 del circuito nacional de BMX Racing, parte del calendario de la Copa Chile a lo largo del año.",
      date: "2026-09-05T10:00:00",
      location_name: "Parque Peñalolén, Santiago",
      lat: -33.4765918,
      lng: -70.5418308,
      category: "contest",
      image_url: "/events/copa-chile-bmx-racing.jpg",
    },
    {
      id: "event-4",
      title: "Preselección Selección Nacional BMX Freestyle 2026",
      description: "Proceso de FEDENACICH para atletas desde los 15 años con licencia UCI 2026 vigente, con vistas a Copa Chile, Panamericanos y Copas del Mundo.",
      date: "2026-11-01T10:00:00",
      location_name: "Pista de BMX Freestyle, Estadio Nacional",
      lat: -33.4662544,
      lng: -70.6106926,
      category: "contest",
      available: false,
      unavailable_reason: "Convocatoria abierta durante 2026, sin una fecha única de evento confirmada.",
    },
    {
      id: "event-5",
      title: "BMX Day Chile",
      description: "El encuentro más importante del ciclismo urbano nacional bajo el lema \"La familia del BMX\": gratuito, abierto a todas las edades, y convoca a bikers, skaters, rollers y scooters. Recorrido que incluye Metro Macul y el skatepark \"Busta Falso\".",
      date: "2026-07-19T11:00:00",
      location_name: "La Cisterna, Santiago",
      lat: -33.5346265,
      lng: -70.6644024,
      category: "jam",
      image_url: "/events/bmx-day-chile.jpg",
      available: false,
      unavailable_reason: "Ya se realizó la edición 2026. Se espera nueva fecha en julio de 2027.",
    },
    {
      id: "event-6",
      title: "CicloRecreoVía",
      description: "20 km de calles liberadas de autos cada domingo en Providencia, Las Condes y otras comunas. La Fundación CicloRecreoVía lleva más de 15 años organizándola.",
      date: "2026-09-06T09:00:00",
      location_name: "Providencia (recorrido por Providencia y Las Condes)",
      lat: -33.4322118,
      lng: -70.6098940,
      category: "ciclismo",
      image_url: "/events/ciclorecreovia.jpg",
    },
    {
      id: "event-7",
      title: "CicloRecreoVía Nocturna",
      description: "Edición especial nocturna entre Plaza Italia y Costanera Center: gratuita, sin inscripción, abierta a peatones, ciclistas, patinadores y sillas de ruedas. Metro habilita el ingreso de bicicletas de forma excepcional.",
      date: "2026-10-03T20:00:00",
      location_name: "Av. Andrés Bello, entre Plaza Italia y Costanera Center",
      lat: -33.4366889,
      lng: -70.6341240,
      category: "ciclismo",
      available: false,
      unavailable_reason: "Edición de octubre anunciada en términos generales; fecha exacta aún no confirmada por la Fundación CicloRecreoVía.",
    },
    {
      id: "event-8",
      title: "Furiosos Ciclistas",
      description: "Marcha ciclista mensual reconocida como patrimonio de la ciudad, coordinada con la Intendencia y Carabineros. Primer martes de cada mes, 20:00 hrs.",
      date: "2026-10-06T20:00:00",
      location_name: "Plaza Italia (Plaza Baquedano), Santiago",
      lat: -33.4366889,
      lng: -70.6341240,
      category: "ciclismo",
      image_url: "/events/furiosos-ciclistas.jpg",
    },
    {
      id: "event-9",
      title: "Día Mundial de la Bicicleta",
      description: "En 2026 se liberaron más de 2.400 bicicletas Bike Itaú de forma gratuita en Santiago entre el 3 y el 30 de junio, hasta 4 viajes diarios de 120 minutos. La bicicleta ya representa el 7,8% de los viajes en la capital.",
      date: "2026-06-03T09:00:00",
      location_name: "Santiago",
      lat: -33.4453519,
      lng: -70.6534063,
      category: "ciclismo",
      available: false,
      unavailable_reason: "La edición 2026 ya finalizó (3 al 30 de junio). Próxima fecha: 3 de junio de 2027.",
    },
    {
      id: "event-10",
      title: "Desafío Gran Santiago y Cicletada Familiar",
      description: "Cicletada familiar presente en calendarios de carreras populares chilenas.",
      date: "2026-11-15T09:00:00",
      location_name: "Santiago",
      lat: -33.4453519,
      lng: -70.6534063,
      category: "ciclismo",
      available: false,
      unavailable_reason: "Fecha variable según temporada; revisar el calendario de carreras populares chilenas más cerca de la fecha.",
    },
    {
      id: "event-11",
      title: "Plazas DeporteLibre",
      description: "Talleres deportivos gratuitos de escalada boulder, calistenia, skate, BMX y danza urbana para niños y niñas de 5 a 15 años, financiados por el Gobierno Regional Metropolitano. Ciclos que se renuevan cada 4 meses en La Pintana, Peñalolén, Santiago, Lo Barnechea y Pirque.",
      date: "2026-09-01T10:00:00",
      location_name: "La Pintana (también en Peñalolén, Santiago, Lo Barnechea y Pirque)",
      lat: -33.5833594,
      lng: -70.6298270,
      category: "workshop",
      available: false,
      unavailable_reason: "Los ciclos se renuevan cada 4 meses; confirma la convocatoria vigente por WhatsApp/redes de la Fundación DeporteLibre.",
    },
    {
      id: "event-12",
      title: "Escuelas municipales de skate y BMX",
      description: "Talleres de verano e invierno gratuitos o de bajo costo en polideportivos y parques de distintas comunas de la Región Metropolitana, formato similar al programa \"Verano en Santiago\".",
      date: "2027-01-05T10:00:00",
      location_name: "Varía por comuna (Región Metropolitana)",
      lat: -33.4453519,
      lng: -70.6534063,
      category: "workshop",
      available: false,
      unavailable_reason: "La oferta varía por comuna y temporada; revisa el sitio de la municipalidad correspondiente antes de cada temporada estival.",
    },
    {
      id: "event-13",
      title: "World Skate Games ASU26",
      description: "Más de 10.000 atletas de más de 100 países se reúnen en Asunción entre el 2 y el 18 de octubre de 2026, en 12 deportes y 23 campeonatos mundiales, incluyendo skateboarding. Varias competencias regionales (como el Downhill de Junín de los Andes) ya operan como clasificatorios oficiales rumbo a este evento, por lo que es esperable que también existan instancias clasificatorias en Chile durante 2026.",
      date: "2026-10-02T09:00:00",
      location_name: "Asunción, Paraguay",
      lat: -25.2800459,
      lng: -57.6343814,
      category: "contest",
      image_url: "/events/world-skate-games-asu26.jpg",
    },
    {
      id: "event-14",
      title: "CicloRecreoVía Viña del Mar",
      description: "Edición costera de la CicloRecreoVía: 3,0 km de calle liberada de autos entre el Reloj de Flores y el sector de Muelle Vergara / Playa El Sol, organizada por la misma fundación que la de Santiago.",
      date: "2026-09-06T09:00:00",
      location_name: "Reloj de Flores, Viña del Mar",
      lat: -33.0232875,
      lng: -71.5671785,
      category: "ciclismo",
      image_url: "/events/ciclorecreovia-vina.jpg",
    },
  ];

  const mockVideos: any[] = [];

  // Keyed by uid (not an array like the other mock stores) since a user
  // profile is always looked up by its own id, never listed/filtered.
  const mockUsers: Record<string, any> = {};

  // GPS-verified spot check-ins, one entry per (createdBy, spot_id) pair -
  // see POST /api/spots/:id/visit.
  const mockVisits: any[] = [];

  // Feed de Comunidad y asistencia a eventos. Empiezan vacíos a propósito:
  // son contenido de usuarios reales, así que un feed en cero es el estado
  // honesto hasta que alguien publique, no algo que haya que rellenar.
  const mockPosts: any[] = [];
  const mockPostComments: any[] = [];
  const mockPostLikes: any[] = [];
  const mockAttendees: any[] = [];

  const mockPhotos = [
    {
      id: "photo-1",
      spot_id: "spot-2",
      photo_url: "https://images.unsplash.com/photo-1547447134-cd3f5c716030?auto=format&fit=crop&q=80&w=800",
      user_name: "skater_99",
      createdAt: new Date().toISOString(),
    },
    // Resto de las fotos que acompañan a cada spot.image_url de arriba -
    // fotografía real del recinto, no aportes de usuarios, por eso van
    // atribuidas a la cuenta oficial en vez de un nombre inventado.
    { id: "photo-2", spot_id: "spot-16", photo_url: "/spots/skatepark-sausalito-2.jpeg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-3", spot_id: "spot-16", photo_url: "/spots/skatepark-sausalito-3.jpeg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-4", spot_id: "spot-17", photo_url: "/spots/skatepark-quintero-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-5", spot_id: "spot-17", photo_url: "/spots/skatepark-quintero-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-6", spot_id: "spot-17", photo_url: "/spots/skatepark-quintero-4.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-7", spot_id: "spot-18", photo_url: "/spots/skatepark-rancagua-mekis-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-8", spot_id: "spot-18", photo_url: "/spots/skatepark-rancagua-mekis-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-9", spot_id: "spot-29", photo_url: "/spots/skatepark-san-alberto-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-10", spot_id: "spot-29", photo_url: "/spots/skatepark-san-alberto-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-11", spot_id: "spot-29", photo_url: "/spots/skatepark-san-alberto-4.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-12", spot_id: "spot-3", photo_url: "/spots/plaza-ciudadania-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-13", spot_id: "spot-3", photo_url: "/spots/plaza-ciudadania-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-14", spot_id: "spot-14", photo_url: "/spots/parque-espejo-agua-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-15", spot_id: "spot-14", photo_url: "/spots/parque-espejo-agua-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-16", spot_id: "spot-15", photo_url: "/spots/skatepark-penuelas-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-17", spot_id: "spot-15", photo_url: "/spots/skatepark-penuelas-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-18", spot_id: "spot-19", photo_url: "/spots/skatepark-san-fernando-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-19", spot_id: "spot-19", photo_url: "/spots/skatepark-san-fernando-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-20", spot_id: "spot-19", photo_url: "/spots/skatepark-san-fernando-4.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-21", spot_id: "spot-20", photo_url: "/spots/skatepark-alameda-talca-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-22", spot_id: "spot-20", photo_url: "/spots/skatepark-alameda-talca-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-23", spot_id: "spot-20", photo_url: "/spots/skatepark-alameda-talca-4.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-24", spot_id: "spot-20", photo_url: "/spots/skatepark-alameda-talca-5.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-25", spot_id: "spot-20", photo_url: "/spots/skatepark-alameda-talca-6.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-26", spot_id: "spot-21", photo_url: "/spots/skatepark-cerro-condell-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-27", spot_id: "spot-21", photo_url: "/spots/skatepark-cerro-condell-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "photo-28", spot_id: "spot-21", photo_url: "/spots/skatepark-cerro-condell-4.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
  ];

  const mockReviews = [
    {
      id: "review-1",
      spot_id: "spot-2",
      user_name: "Alex Skater",
      user_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alexskater",
      rating: 5,
      comment: "El mejor bowl de la ciudad, siempre buena vibra y mucha inspiración.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "review-2",
      spot_id: "spot-2",
      user_name: "Mia Wheels",
      user_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=miawheels",
      rating: 4,
      comment: "Perfecto para todos los niveles. Muy bien mantenido.",
      createdAt: new Date().toISOString(),
    },
  ];

  // Resto de las fotos que acompañan a cada event.image_url de arriba -
  // fotografía real del evento (o flyers oficiales), no aportes de
  // usuarios, por eso van atribuidas a la cuenta oficial.
  const mockEventPhotos = [
    { id: "event-photo-1", event_id: "event-1", photo_url: "/events/road-the-gap-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-2", event_id: "event-1", photo_url: "/events/road-the-gap-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-3", event_id: "event-1", photo_url: "/events/road-the-gap-4.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-4", event_id: "event-2", photo_url: "/events/campeonato-bmx-freestyle-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-5", event_id: "event-2", photo_url: "/events/campeonato-bmx-freestyle-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-6", event_id: "event-3", photo_url: "/events/copa-chile-bmx-racing-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-7", event_id: "event-3", photo_url: "/events/copa-chile-bmx-racing-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-8", event_id: "event-3", photo_url: "/events/copa-chile-bmx-racing-4.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-9", event_id: "event-5", photo_url: "/events/bmx-day-chile-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-10", event_id: "event-5", photo_url: "/events/bmx-day-chile-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-11", event_id: "event-6", photo_url: "/events/ciclorecreovia-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-12", event_id: "event-6", photo_url: "/events/ciclorecreovia-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-13", event_id: "event-6", photo_url: "/events/ciclorecreovia-4.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-14", event_id: "event-6", photo_url: "/events/ciclorecreovia-mapa.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-15", event_id: "event-8", photo_url: "/events/furiosos-ciclistas-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-16", event_id: "event-8", photo_url: "/events/furiosos-ciclistas-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-17", event_id: "event-8", photo_url: "/events/furiosos-ciclistas-4.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-18", event_id: "event-8", photo_url: "/events/furiosos-ciclistas-5.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-19", event_id: "event-13", photo_url: "/events/world-skate-games-asu26-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-20", event_id: "event-13", photo_url: "/events/world-skate-games-asu26-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-21", event_id: "event-14", photo_url: "/events/ciclorecreovia-vina-mapa.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-22", event_id: "event-14", photo_url: "/events/ciclorecreovia-vina-2.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
    { id: "event-photo-23", event_id: "event-14", photo_url: "/events/ciclorecreovia-vina-3.jpg", user_name: "UrbanFlow", createdAt: new Date().toISOString() },
  ];

  const mockEventReviews = [
    {
      id: "event-review-1",
      event_id: "event-1",
      user_name: "Tony Rider",
      user_avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=tonyrider",
      rating: 5,
      comment: "Excelente organización el año pasado, muy buen ambiente y nivel altísimo.",
      createdAt: new Date().toISOString(),
    },
  ];

  // --- Spots ---------------------------------------------------------

  // Attaches a real average `rating` + `review_count` to each spot (from
  // actual submitted reviews) - never fabricated, omitted when a spot has
  // no reviews yet.
  function withRatings(items: any[], reviews: any[], idField: "spot_id" | "event_id") {
    const byId = new Map<string, number[]>();
    for (const r of reviews) {
      const key = r[idField];
      if (!byId.has(key)) byId.set(key, []);
      byId.get(key)!.push(r.rating);
    }
    return items.map(item => {
      const ratings = byId.get(item.id);
      if (!ratings || ratings.length === 0) return item;
      const rating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      return { ...item, rating, review_count: ratings.length };
    });
  }

  // --- Challenges ------------------------------------------------------
  //
  // Real progress only: each challenge's `metric` is a count of documents
  // this user actually created (createdBy == uid), computed fresh on every
  // request from spots/photos/reviews/visits - see GET /api/users/me/challenges
  // below. spotsVisited counts distinct spot ids from GPS-verified check-ins
  // (POST /api/spots/:id/visit) - a check-in only succeeds when the caller's
  // reported coordinates are within VISIT_RADIUS_METERS of the spot, so this
  // can't be farmed by repeatedly tapping the button from home. xp is
  // derived the same way (sum of completed challenges' reward), never a
  // separately stored/incrementable field, so it can't drift out of sync
  // with what the user actually did.
  const CHALLENGE_DEFS = [
    { id: "primer-spot", title: "Sube tu primer spot", description: "Comparte un spot nuevo con la comunidad.", metric: "spotsCreated", goal: 1, xp: 50 },
    { id: "explorador-frecuente", title: "Cinco spots compartidos", description: "Sube 5 spots distintos al mapa.", metric: "spotsCreated", goal: 5, xp: 100 },
    // Destacado en la UI (ver FEATURED_CHALLENGE_ID en MobileLayout/DesktopLayout) -
    // el tier "difícil" de spotsVisited, con más XP que cualquier otro desafío.
    { id: "explorador-legendario", title: "Explorador legendario", description: "Visita 10 spots distintos en persona.", metric: "spotsVisited", goal: 10, xp: 200 },
    { id: "fotografo-urbano", title: "Fotógrafo urbano", description: "Sube 5 fotos a spots o eventos.", metric: "photosUploaded", goal: 5, xp: 50 },
    { id: "voz-comunidad", title: "Voz de la comunidad", description: "Deja 3 reseñas.", metric: "reviewsWritten", goal: 3, xp: 30 },
    { id: "primera-visita", title: "Primera visita", description: "Marca tu visita a un spot estando ahí.", metric: "spotsVisited", goal: 1, xp: 30 },
    { id: "explorador-fisico", title: "Explorador físico", description: "Visita 5 spots distintos en persona.", metric: "spotsVisited", goal: 5, xp: 100 },
  ] as const;

  // `stats` son los mismos counts sin recortar al goal del desafío - la fila
  // de estadísticas del perfil los muestra tal cual, así que un usuario con
  // 30 visitas ve 30 y no el 10 tope del desafío.
  function buildChallenges(counts: { spotsCreated: number; photosUploaded: number; reviewsWritten: number; spotsVisited: number }) {
    const challenges = CHALLENGE_DEFS.map(def => {
      const progress = Math.min(counts[def.metric as keyof typeof counts] ?? 0, def.goal);
      return { ...def, progress, completed: progress >= def.goal };
    });
    const xp = challenges.filter(c => c.completed).reduce((sum, c) => sum + c.xp, 0);
    return { challenges, xp, stats: counts };
  }

  app.get("/api/spots", async (req, res) => {
    try {
      const [spotsSnapshot, reviewsSnapshot] = await Promise.all([spotsCol.get(), reviewsCol.get()]);
      const spots = spotsSnapshot.docs.map(docWithId);
      const reviews = reviewsSnapshot.docs.map(d => d.data());
      res.json(withRatings(spots, reviews, "spot_id"));
    } catch (err) {
      console.warn("Failed to fetch spots from Firestore, returning local fallback spots.");
      res.json(withRatings(mockSpots, mockReviews, "spot_id"));
    }
  });

  // Any signed-in user can propose a spot. validateBody enforces the
  // shape/types/ranges of every field (see serverSchemas.ts) before this
  // handler ever runs. requireAuth stamps createdBy from the verified
  // token - the client can no longer claim to be someone else.
  app.post("/api/spots", requireAuth, validateBody(spotCreateSchema), async (req, res) => {
    try {
      const {
        name, description, lat, lng, category, marker_color,
        show_label, image_url, location_name, floor_quality, obstacles, open_hours,
        spot_type, features, difficulty,
      } = req.body;

      try {
        const docRef = await spotsCol.add({
          name,
          description,
          lat,
          lng,
          category,
          marker_color,
          show_label,
          image_url: image_url ?? null,
          location_name: location_name ?? null,
          floor_quality: floor_quality ?? null,
          obstacles: obstacles ?? null,
          open_hours: open_hours ?? null,
          spot_type: spot_type ?? null,
          features: features ?? null,
          difficulty: difficulty ?? null,
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: FieldValue.serverTimestamp(),
        });
        return res.json({ id: docRef.id });
      } catch (firestoreErr) {
        console.warn("Firestore save failed, using local in-memory store:", (firestoreErr as Error).message);
        const newSpot = {
          id: `spot-${Date.now()}`,
          name,
          description: description || "",
          lat,
          lng,
          category,
          marker_color: marker_color || "#10b981",
          show_label: show_label ?? true,
          image_url: image_url ?? null,
          location_name: location_name ?? null,
          floor_quality: floor_quality ?? null,
          obstacles: obstacles ?? null,
          open_hours: open_hours ?? null,
          spot_type: spot_type ?? null,
          features: features ?? null,
          difficulty: difficulty ?? null,
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: new Date().toISOString(),
        };
        mockSpots.unshift(newSpot);
        return res.json({ id: newSpot.id, ...newSpot });
      }
    } catch (err) {
      console.error("Failed to create spot:", err);
      res.status(500).json({ error: "Failed to create spot" });
    }
  });

  // Deleting a spot is an admin action (matches the original app's intent:
  // only admins moderate the map). Also cascades to that spot's videos,
  // since Firestore has no foreign keys to do this automatically.
  app.delete("/api/spots/:id", requireAdmin, validateIdParam, async (req, res) => {
    try {
      const spotId = req.params.id;
      try {
        const orphanVideos = await videosCol.where("spot_id", "==", spotId).get();

        const batch = adminDb.batch();
        orphanVideos.docs.forEach((doc) => batch.delete(doc.ref));
        batch.delete(spotsCol.doc(spotId));
        await batch.commit();
      } catch (firestoreErr) {
        console.warn("Firestore delete failed, deleting from in-memory fallback:", (firestoreErr as Error).message);
        const idx = mockSpots.findIndex(s => s.id === spotId);
        if (idx !== -1) mockSpots.splice(idx, 1);
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete spot:", err);
      res.status(500).json({ error: "Failed to delete spot" });
    }
  });

  // --- Events ----------------------------------------------------------

  app.get("/api/events", async (req, res) => {
    try {
      const [eventsSnapshot, reviewsSnapshot] = await Promise.all([
        eventsCol.orderBy("date", "asc").get(),
        eventReviewsCol.get(),
      ]);
      const events = eventsSnapshot.docs.map(docWithId);
      const reviews = reviewsSnapshot.docs.map(d => d.data());
      res.json(withRatings(events, reviews, "event_id"));
    } catch (err) {
      console.warn("Failed to fetch events from Firestore, returning local fallback events.");
      res.json(withRatings(mockEvents, mockEventReviews, "event_id"));
    }
  });

  // Events are curated/official content, not user-generated - and nothing
  // in the client currently calls this. Admin-only.
  app.post("/api/events", requireAdmin, validateBody(eventCreateSchema), async (req, res) => {
    try {
      const { title, description, date, location_name, lat, lng, category, image_url } = req.body;

      try {
        const docRef = await eventsCol.add({
          title,
          description,
          date,
          location_name: location_name ?? null,
          lat,
          lng,
          category: category ?? null,
          image_url: image_url ?? null,
          createdAt: FieldValue.serverTimestamp(),
        });

        res.json({ id: docRef.id });
      } catch (firestoreErr) {
        console.warn("Firestore event save failed, saving in-memory:", (firestoreErr as Error).message);
        const newEvent = {
          id: `event-${Date.now()}`,
          title,
          description: description || "",
          date,
          location_name: location_name ?? null,
          lat,
          lng,
          category: category ?? null,
          image_url: image_url ?? null,
        };
        mockEvents.unshift(newEvent);
        res.json({ id: newEvent.id });
      }
    } catch (err) {
      console.error("Failed to create event:", err);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // Deleting an event is an admin action, same pattern as spot deletion.
  app.delete("/api/events/:id", requireAdmin, validateIdParam, async (req, res) => {
    try {
      const eventId = req.params.id;
      try {
        await eventsCol.doc(eventId).delete();
      } catch (firestoreErr) {
        console.warn("Firestore delete failed, deleting from in-memory fallback:", (firestoreErr as Error).message);
        const idx = mockEvents.findIndex(e => e.id === eventId);
        if (idx !== -1) mockEvents.splice(idx, 1);
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete event:", err);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // --- Photos --------------------------------------------------------------
  // User-submitted spot photos for the gallery section. Unlike video clips,
  // these are shown immediately (no admin approval queue) - lower-risk,
  // static content.

  app.get("/api/spots/:id/photos", validateIdParam, async (req, res) => {
    try {
      const snapshot = await photosCol.where("spot_id", "==", req.params.id).get();
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      res.json(mockPhotos.filter(p => p.spot_id === req.params.id));
    }
  });

  app.post("/api/photos", requireAuth, validateBody(photoCreateSchema), async (req, res) => {
    try {
      const { spot_id, photo_url, user_name } = req.body;

      try {
        const spotSnap = await spotsCol.doc(spot_id).get();
        if (!spotSnap.exists) {
          return res.status(404).json({ error: "Spot not found" });
        }

        const docRef = await photosCol.add({
          spot_id,
          photo_url,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: FieldValue.serverTimestamp(),
        });
        return res.json({ id: docRef.id });
      } catch (firestoreErr) {
        console.warn("Firestore photo add failed, using mock:", (firestoreErr as Error).message);
        const newPhoto = {
          id: `photo-${Date.now()}`,
          spot_id,
          photo_url,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: new Date().toISOString(),
        };
        mockPhotos.unshift(newPhoto);
        return res.json({ id: newPhoto.id });
      }
    } catch (err) {
      console.error("Failed to upload photo:", err);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });

  // --- Reviews ---------------------------------------------------------

  app.get("/api/spots/:id/reviews", validateIdParam, async (req, res) => {
    try {
      const snapshot = await reviewsCol.where("spot_id", "==", req.params.id).get();
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      res.json(mockReviews.filter(r => r.spot_id === req.params.id));
    }
  });

  app.post("/api/reviews", requireAuth, validateBody(reviewCreateSchema), async (req, res) => {
    try {
      const { spot_id, rating, comment, user_name, user_avatar } = req.body;

      try {
        const spotSnap = await spotsCol.doc(spot_id).get();
        if (!spotSnap.exists) {
          return res.status(404).json({ error: "Spot not found" });
        }

        const docRef = await reviewsCol.add({
          spot_id,
          rating,
          comment,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          user_avatar: user_avatar ?? null,
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: FieldValue.serverTimestamp(),
        });
        return res.json({ id: docRef.id });
      } catch (firestoreErr) {
        console.warn("Firestore review add failed, using mock:", (firestoreErr as Error).message);
        const newReview = {
          id: `review-${Date.now()}`,
          spot_id,
          rating,
          comment,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          user_avatar: user_avatar ?? null,
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: new Date().toISOString(),
        };
        mockReviews.unshift(newReview);
        return res.json({ id: newReview.id });
      }
    } catch (err) {
      console.error("Failed to submit review:", err);
      res.status(500).json({ error: "Failed to submit review" });
    }
  });

  // --- Event Photos ----------------------------------------------------
  // Same pattern as spot photos: shown immediately, no admin approval queue.

  app.get("/api/events/:id/photos", validateIdParam, async (req, res) => {
    try {
      const snapshot = await eventPhotosCol.where("event_id", "==", req.params.id).get();
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      res.json(mockEventPhotos.filter(p => p.event_id === req.params.id));
    }
  });

  app.post("/api/event-photos", requireAuth, validateBody(eventPhotoCreateSchema), async (req, res) => {
    try {
      const { event_id, photo_url, user_name } = req.body;

      try {
        const eventSnap = await eventsCol.doc(event_id).get();
        if (!eventSnap.exists) {
          return res.status(404).json({ error: "Event not found" });
        }

        const docRef = await eventPhotosCol.add({
          event_id,
          photo_url,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: FieldValue.serverTimestamp(),
        });
        return res.json({ id: docRef.id });
      } catch (firestoreErr) {
        console.warn("Firestore event photo add failed, using mock:", (firestoreErr as Error).message);
        const newPhoto = {
          id: `event-photo-${Date.now()}`,
          event_id,
          photo_url,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: new Date().toISOString(),
        };
        mockEventPhotos.unshift(newPhoto);
        return res.json({ id: newPhoto.id });
      }
    } catch (err) {
      console.error("Failed to upload event photo:", err);
      res.status(500).json({ error: "Failed to upload event photo" });
    }
  });

  // --- Event Reviews -----------------------------------------------------

  app.get("/api/events/:id/reviews", validateIdParam, async (req, res) => {
    try {
      const snapshot = await eventReviewsCol.where("event_id", "==", req.params.id).get();
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      res.json(mockEventReviews.filter(r => r.event_id === req.params.id));
    }
  });

  app.post("/api/event-reviews", requireAuth, validateBody(eventReviewCreateSchema), async (req, res) => {
    try {
      const { event_id, rating, comment, user_name, user_avatar } = req.body;

      try {
        const eventSnap = await eventsCol.doc(event_id).get();
        if (!eventSnap.exists) {
          return res.status(404).json({ error: "Event not found" });
        }

        const docRef = await eventReviewsCol.add({
          event_id,
          rating,
          comment,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          user_avatar: user_avatar ?? null,
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: FieldValue.serverTimestamp(),
        });
        return res.json({ id: docRef.id });
      } catch (firestoreErr) {
        console.warn("Firestore event review add failed, using mock:", (firestoreErr as Error).message);
        const newReview = {
          id: `event-review-${Date.now()}`,
          event_id,
          rating,
          comment,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          user_avatar: user_avatar ?? null,
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: new Date().toISOString(),
        };
        mockEventReviews.unshift(newReview);
        return res.json({ id: newReview.id });
      }
    } catch (err) {
      console.error("Failed to submit event review:", err);
      res.status(500).json({ error: "Failed to submit event review" });
    }
  });

  // --- Videos ------------------------------------------------------------

  app.get("/api/spots/:id/videos", validateIdParam, async (req, res) => {
    try {
      const snapshot = await videosCol
        .where("spot_id", "==", req.params.id)
        .where("status", "==", "approved")
        .get();
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      const filtered = mockVideos.filter(v => v.spot_id === req.params.id && v.status === "approved");
      res.json(filtered);
    }
  });

  app.get("/api/admin/pending-videos", requireAdmin, async (req, res) => {
    try {
      const snapshot = await videosCol.where("status", "==", "pending").get();
      res.json(snapshot.docs.map(docWithId));
    } catch (err) {
      const pending = mockVideos.filter(v => v.status === "pending");
      res.json(pending);
    }
  });

  app.post("/api/videos", requireAuth, validateBody(videoCreateSchema), async (req, res) => {
    try {
      const { spot_id, video_url, user_name } = req.body;

      try {
        const spotSnap = await spotsCol.doc(spot_id).get();
        if (!spotSnap.exists) {
          return res.status(404).json({ error: "Spot not found" });
        }

        const docRef = await videosCol.add({
          spot_id,
          video_url,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          status: "pending",
          spot_name: spotSnap.data()?.name ?? null,
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: FieldValue.serverTimestamp(),
        });

        return res.json({ id: docRef.id });
      } catch (firestoreErr) {
        console.warn("Firestore video add failed, using mock:", (firestoreErr as Error).message);
        const matchingSpot = mockSpots.find(s => s.id === spot_id);
        const newVid = {
          id: `video-${Date.now()}`,
          spot_id,
          video_url,
          user_name: user_name ?? req.authUser?.email ?? "Anónimo",
          status: "pending",
          spot_name: matchingSpot?.name ?? "Spot",
          createdBy: req.authUser?.uid ?? "guest",
          createdAt: new Date().toISOString(),
        };
        mockVideos.unshift(newVid);
        return res.json({ id: newVid.id });
      }
    } catch (err) {
      console.error("Failed to upload video:", err);
      res.status(500).json({ error: "Failed to upload video" });
    }
  });

  app.post("/api/admin/videos/:id/approve", requireAdmin, validateIdParam, async (req, res) => {
    try {
      try {
        await videosCol.doc(req.params.id).update({ status: "approved" });
      } catch (firestoreErr) {
        const vid = mockVideos.find(v => v.id === req.params.id);
        if (vid) vid.status = "approved";
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to approve video:", err);
      res.status(500).json({ error: "Failed to approve video" });
    }
  });

  app.post("/api/admin/videos/:id/reject", requireAdmin, validateIdParam, async (req, res) => {
    try {
      try {
        await videosCol.doc(req.params.id).update({ status: "rejected" });
      } catch (firestoreErr) {
        const vid = mockVideos.find(v => v.id === req.params.id);
        if (vid) vid.status = "rejected";
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to reject video:", err);
      res.status(500).json({ error: "Failed to reject video" });
    }
  });

  // --- Users -------------------------------------------------------
  //
  // Profile, favorites and challenges/XP. Google sign-in already creates a
  // bare users/{uid} doc client-side (see useAuth.ts: uid/email/
  // displayName/photoURL/role) - the fields added here (city, discipline,
  // bio, favorites) just aren't on it yet, so every read below defaults
  // them rather than assuming they exist. Guest sessions never get that
  // client-side doc at all, so GET creates one lazily on first request.

  function defaultProfileFields() {
    return { city: null, discipline: null, bio: null, bannerURL: null, instagram: null, favorites: [] as string[] };
  }

  function freshProfile(uid: string, email: string | null) {
    return {
      uid,
      email,
      displayName: null,
      photoURL: null,
      role: "user",
      ...defaultProfileFields(),
    };
  }

  app.get("/api/users/me", requireAuth, async (req, res) => {
    const uid = req.authUser!.uid;
    try {
      const snap = await usersCol.doc(uid).get();
      if (snap.exists) {
        return res.json({ ...freshProfile(uid, req.authUser!.email), ...snap.data() });
      }
      const fresh = { ...freshProfile(uid, req.authUser!.email), createdAt: FieldValue.serverTimestamp() };
      await usersCol.doc(uid).set(fresh);
      return res.json({ ...fresh, createdAt: new Date().toISOString() });
    } catch (firestoreErr) {
      console.warn("Firestore user fetch failed, using in-memory fallback:", (firestoreErr as Error).message);
      if (!mockUsers[uid]) {
        mockUsers[uid] = { ...freshProfile(uid, req.authUser!.email), createdAt: new Date().toISOString() };
      }
      res.json(mockUsers[uid]);
    }
  });

  // validateBody already stripped anything not in profileUpdateSchema and
  // only includes the fields the client actually sent, so this is a
  // partial update (merge), never a full overwrite of the profile doc.
  app.put("/api/users/me", requireAuth, validateBody(profileUpdateSchema), async (req, res) => {
    const uid = req.authUser!.uid;
    try {
      try {
        await usersCol.doc(uid).set(req.body, { merge: true });
        const snap = await usersCol.doc(uid).get();
        return res.json({ ...freshProfile(uid, req.authUser!.email), ...snap.data() });
      } catch (firestoreErr) {
        console.warn("Firestore profile update failed, using in-memory fallback:", (firestoreErr as Error).message);
        if (!mockUsers[uid]) {
          mockUsers[uid] = { ...freshProfile(uid, req.authUser!.email), createdAt: new Date().toISOString() };
        }
        Object.assign(mockUsers[uid], req.body);
        return res.json(mockUsers[uid]);
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/users/me/favorites/:id", requireAuth, validateIdParam, async (req, res) => {
    const uid = req.authUser!.uid;
    const spotId = req.params.id;
    try {
      try {
        await usersCol.doc(uid).set({ favorites: FieldValue.arrayUnion(spotId) }, { merge: true });
      } catch (firestoreErr) {
        console.warn("Firestore favorite add failed, using in-memory fallback:", (firestoreErr as Error).message);
        if (!mockUsers[uid]) {
          mockUsers[uid] = { ...freshProfile(uid, req.authUser!.email), createdAt: new Date().toISOString() };
        }
        if (!mockUsers[uid].favorites.includes(spotId)) mockUsers[uid].favorites.push(spotId);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to add favorite:", err);
      res.status(500).json({ error: "Failed to add favorite" });
    }
  });

  app.delete("/api/users/me/favorites/:id", requireAuth, validateIdParam, async (req, res) => {
    const uid = req.authUser!.uid;
    const spotId = req.params.id;
    try {
      try {
        await usersCol.doc(uid).set({ favorites: FieldValue.arrayRemove(spotId) }, { merge: true });
      } catch (firestoreErr) {
        console.warn("Firestore favorite remove failed, using in-memory fallback:", (firestoreErr as Error).message);
        if (mockUsers[uid]) {
          mockUsers[uid].favorites = (mockUsers[uid].favorites || []).filter((id: string) => id !== spotId);
        }
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to remove favorite:", err);
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  });

  // GPS check-in: only succeeds when the caller's reported lat/lng lands
  // within VISIT_RADIUS_METERS of the spot's own coordinates. Idempotent
  // per (uid, spot) - re-visiting the same spot doesn't create duplicate
  // rows, since the challenge only cares about distinct spots visited.
  app.post("/api/spots/:id/visit", requireAuth, validateIdParam, validateBody(visitCreateSchema), async (req, res) => {
    const uid = req.authUser!.uid;
    const spotId = req.params.id;
    const { lat, lng } = req.body;
    try {
      let spot: { lat: number; lng: number } | undefined;
      try {
        const spotSnap = await spotsCol.doc(spotId).get();
        if (!spotSnap.exists) return res.status(404).json({ error: "Spot not found" });
        spot = spotSnap.data() as { lat: number; lng: number };
      } catch (firestoreErr) {
        spot = mockSpots.find((s: any) => s.id === spotId);
        if (!spot) return res.status(404).json({ error: "Spot not found" });
      }

      const distance = distanceMeters(lat, lng, spot.lat, spot.lng);
      if (distance > VISIT_RADIUS_METERS) {
        return res.status(400).json({ error: "No estás lo suficientemente cerca del spot para marcar la visita", distanceMeters: Math.round(distance) });
      }

      try {
        const existing = await visitsCol.where("createdBy", "==", uid).where("spot_id", "==", spotId).limit(1).get();
        if (existing.empty) {
          await visitsCol.add({ spot_id: spotId, createdBy: uid, createdAt: FieldValue.serverTimestamp() });
        }
      } catch (firestoreErr) {
        console.warn("Firestore visit add failed, using in-memory fallback:", (firestoreErr as Error).message);
        if (!mockVisits.some((v: any) => v.createdBy === uid && v.spot_id === spotId)) {
          mockVisits.push({ id: `visit-${Date.now()}`, spot_id: spotId, createdBy: uid, createdAt: new Date().toISOString() });
        }
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to record visit:", err);
      res.status(500).json({ error: "Failed to record visit" });
    }
  });

  app.get("/api/users/me/challenges", requireAuth, async (req, res) => {
    const uid = req.authUser!.uid;
    try {
      const [spotsSnap, photosSnap, eventPhotosSnap, reviewsSnap, eventReviewsSnap, visitsSnap] = await Promise.all([
        spotsCol.where("createdBy", "==", uid).get(),
        photosCol.where("createdBy", "==", uid).get(),
        eventPhotosCol.where("createdBy", "==", uid).get(),
        reviewsCol.where("createdBy", "==", uid).get(),
        eventReviewsCol.where("createdBy", "==", uid).get(),
        visitsCol.where("createdBy", "==", uid).get(),
      ]);
      res.json(buildChallenges({
        spotsCreated: spotsSnap.size,
        photosUploaded: photosSnap.size + eventPhotosSnap.size,
        reviewsWritten: reviewsSnap.size + eventReviewsSnap.size,
        spotsVisited: new Set(visitsSnap.docs.map(d => d.data().spot_id)).size,
      }));
    } catch (firestoreErr) {
      console.warn("Firestore challenge count failed, using in-memory fallback:", (firestoreErr as Error).message);
      res.json(buildChallenges({
        spotsCreated: mockSpots.filter((s: any) => s.createdBy === uid).length,
        photosUploaded: mockPhotos.filter((p: any) => p.createdBy === uid).length + mockEventPhotos.filter((p: any) => p.createdBy === uid).length,
        reviewsWritten: mockReviews.filter((r: any) => r.createdBy === uid).length + mockEventReviews.filter((r: any) => r.createdBy === uid).length,
        spotsVisited: new Set(mockVisits.filter((v: any) => v.createdBy === uid).map((v: any) => v.spot_id)).size,
      }));
    }
  });

  // --- Actividad / Mis spots / Notificaciones --------------------------
  //
  // Las tres pantallas se arman con datos que ya se guardaban (todo lleva
  // createdBy y createdAt) - antes sólo se contaban para los desafíos y
  // nunca se listaban. No hay ninguna tabla nueva detrás de esto.

  // createdAt puede ser un Timestamp de Firestore o un string ISO según de
  // dónde venga el documento; ordenamos siempre sobre milisegundos.
  function timeOf(value: any): number {
    if (!value) return 0;
    if (typeof value === "string") return new Date(value).getTime() || 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value._seconds === "number") return value._seconds * 1000;
    return 0;
  }

  function sortByNewest<T extends { createdAt?: any }>(items: T[]) {
    return items.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
  }

  async function readCollection(col: FirebaseFirestore.Query, fallback: any[]) {
    try {
      const snap = await col.get();
      return snap.docs.map(docWithId);
    } catch {
      return fallback;
    }
  }

  app.get("/api/users/me/activity", requireAuth, async (req, res) => {
    const uid = req.authUser!.uid;
    try {
      const [spots, photos, eventPhotos, reviews, eventReviews, visits, allSpots] = await Promise.all([
        readCollection(spotsCol.where("createdBy", "==", uid), mockSpots.filter((s: any) => s.createdBy === uid)),
        readCollection(photosCol.where("createdBy", "==", uid), mockPhotos.filter((p: any) => p.createdBy === uid)),
        readCollection(eventPhotosCol.where("createdBy", "==", uid), mockEventPhotos.filter((p: any) => p.createdBy === uid)),
        readCollection(reviewsCol.where("createdBy", "==", uid), mockReviews.filter((r: any) => r.createdBy === uid)),
        readCollection(eventReviewsCol.where("createdBy", "==", uid), mockEventReviews.filter((r: any) => r.createdBy === uid)),
        readCollection(visitsCol.where("createdBy", "==", uid), mockVisits.filter((v: any) => v.createdBy === uid)),
        readCollection(spotsCol, mockSpots),
      ]);

      const spotName = (id: string) => (allSpots as any[]).find(s => s.id === id)?.name ?? "un spot";

      const items = [
        ...(spots as any[]).map(s => ({ id: `spot-${s.id}`, type: "spot_created", title: s.name, detail: s.location_name ?? null, spot_id: s.id, image_url: s.image_url ?? null, createdAt: s.createdAt })),
        ...(photos as any[]).map(p => ({ id: `photo-${p.id}`, type: "photo_uploaded", title: spotName(p.spot_id), detail: null, spot_id: p.spot_id, image_url: p.photo_url, createdAt: p.createdAt })),
        ...(eventPhotos as any[]).map(p => ({ id: `eventphoto-${p.id}`, type: "photo_uploaded", title: "un evento", detail: null, spot_id: null, image_url: p.photo_url, createdAt: p.createdAt })),
        ...(reviews as any[]).map(r => ({ id: `review-${r.id}`, type: "review_written", title: spotName(r.spot_id), detail: r.comment || null, rating: r.rating, spot_id: r.spot_id, image_url: null, createdAt: r.createdAt })),
        ...(eventReviews as any[]).map(r => ({ id: `eventreview-${r.id}`, type: "review_written", title: "un evento", detail: r.comment || null, rating: r.rating, spot_id: null, image_url: null, createdAt: r.createdAt })),
        ...(visits as any[]).map(v => ({ id: `visit-${v.id}`, type: "spot_visited", title: spotName(v.spot_id), detail: null, spot_id: v.spot_id, image_url: null, createdAt: v.createdAt })),
      ];

      res.json(sortByNewest(items).slice(0, 60));
    } catch (err) {
      console.error("Failed to build activity:", err);
      res.status(500).json({ error: "Failed to build activity" });
    }
  });

  app.get("/api/users/me/spots", requireAuth, async (req, res) => {
    const uid = req.authUser!.uid;
    const [spots, reviews] = await Promise.all([
      readCollection(spotsCol.where("createdBy", "==", uid), mockSpots.filter((s: any) => s.createdBy === uid)),
      readCollection(reviewsCol, mockReviews),
    ]);
    res.json(sortByNewest(withRatings(spots as any[], reviews as any[], "spot_id")));
  });

  // Notificaciones reales: lo que OTROS hicieron en los spots que creaste.
  // No hay sistema de push ni notificaciones fabricadas - si nadie ha
  // interactuado con tus spots, esto viene vacío, que es la verdad.
  app.get("/api/users/me/notifications", requireAuth, async (req, res) => {
    const uid = req.authUser!.uid;
    try {
      const mySpots = await readCollection(spotsCol.where("createdBy", "==", uid), mockSpots.filter((s: any) => s.createdBy === uid));
      const myIds = new Set((mySpots as any[]).map(s => s.id));
      if (myIds.size === 0) return res.json([]);

      const [reviews, photos] = await Promise.all([
        readCollection(reviewsCol, mockReviews),
        readCollection(photosCol, mockPhotos),
      ]);
      const nameOf = (id: string) => (mySpots as any[]).find(s => s.id === id)?.name ?? "tu spot";

      const items = [
        ...(reviews as any[])
          .filter(r => myIds.has(r.spot_id) && r.createdBy !== uid)
          .map(r => ({ id: `review-${r.id}`, type: "review_on_my_spot", actor: r.user_name || "Alguien", actor_avatar: r.user_avatar ?? null, spot_id: r.spot_id, spot_name: nameOf(r.spot_id), rating: r.rating, detail: r.comment || null, createdAt: r.createdAt })),
        ...(photos as any[])
          .filter(p => myIds.has(p.spot_id) && p.createdBy !== uid)
          .map(p => ({ id: `photo-${p.id}`, type: "photo_on_my_spot", actor: p.user_name || "Alguien", actor_avatar: null, spot_id: p.spot_id, spot_name: nameOf(p.spot_id), detail: null, image_url: p.photo_url, createdAt: p.createdAt })),
      ];

      res.json(sortByNewest(items).slice(0, 50));
    } catch (err) {
      console.error("Failed to build notifications:", err);
      res.status(500).json({ error: "Failed to build notifications" });
    }
  });

  // --- Asistencia a eventos ---------------------------------------------
  //
  // "Voy a ir" es idempotente por (uid, event_id), igual que el check-in de
  // spots: apretar dos veces no infla el conteo.

  app.get("/api/events/:id/attendees", validateIdParam, async (req, res) => {
    const rows = await readCollection(attendeesCol.where("event_id", "==", req.params.id), mockAttendees.filter((a: any) => a.event_id === req.params.id));
    res.json({ count: (rows as any[]).length });
  });

  app.get("/api/users/me/attendance", requireAuth, async (req, res) => {
    const uid = req.authUser!.uid;
    const rows = await readCollection(attendeesCol.where("createdBy", "==", uid), mockAttendees.filter((a: any) => a.createdBy === uid));
    res.json((rows as any[]).map(r => r.event_id));
  });

  app.post("/api/events/:id/attend", requireAuth, validateIdParam, async (req, res) => {
    const uid = req.authUser!.uid;
    const eventId = req.params.id;
    try {
      try {
        const existing = await attendeesCol.where("createdBy", "==", uid).where("event_id", "==", eventId).limit(1).get();
        if (existing.empty) {
          await attendeesCol.add({ event_id: eventId, createdBy: uid, createdAt: FieldValue.serverTimestamp() });
        }
      } catch (firestoreErr) {
        console.warn("Firestore attend failed, using in-memory fallback:", (firestoreErr as Error).message);
        if (!mockAttendees.some((a: any) => a.createdBy === uid && a.event_id === eventId)) {
          mockAttendees.push({ id: `attend-${Date.now()}`, event_id: eventId, createdBy: uid, createdAt: new Date().toISOString() });
        }
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to attend event:", err);
      res.status(500).json({ error: "Failed to attend event" });
    }
  });

  app.delete("/api/events/:id/attend", requireAuth, validateIdParam, async (req, res) => {
    const uid = req.authUser!.uid;
    const eventId = req.params.id;
    try {
      try {
        const existing = await attendeesCol.where("createdBy", "==", uid).where("event_id", "==", eventId).get();
        await Promise.all(existing.docs.map(d => d.ref.delete()));
      } catch (firestoreErr) {
        console.warn("Firestore unattend failed, using in-memory fallback:", (firestoreErr as Error).message);
        const idx = mockAttendees.findIndex((a: any) => a.createdBy === uid && a.event_id === eventId);
        if (idx !== -1) mockAttendees.splice(idx, 1);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to leave event:", err);
      res.status(500).json({ error: "Failed to leave event" });
    }
  });

  // --- Comunidad: publicaciones, me gusta y comentarios ------------------
  //
  // El feed era una maqueta con posts fijos en constants.tsx. Ahora es real:
  // cada publicación la crea un usuario autenticado y guarda su uid, así que
  // el perfil público de más abajo puede reconstruir quién publicó qué.
  // Autor denormalizado (user_name/user_avatar) igual que en las reseñas,
  // para no tener que resolver N perfiles al pintar el feed.

  async function decoratePosts(posts: any[], uid: string | null) {
    const [likes, comments] = await Promise.all([
      readCollection(postLikesCol, mockPostLikes),
      readCollection(postCommentsCol, mockPostComments),
    ]);
    return posts.map(p => ({
      ...p,
      likeCount: (likes as any[]).filter(l => l.post_id === p.id).length,
      commentCount: (comments as any[]).filter(c => c.post_id === p.id).length,
      likedByMe: uid ? (likes as any[]).some(l => l.post_id === p.id && l.createdBy === uid) : false,
    }));
  }

  app.get("/api/posts", optionalAuth, async (req, res) => {
    const uid = req.authUser?.uid ?? null;
    const posts = await readCollection(postsCol, mockPosts);
    res.json(await decoratePosts(sortByNewest(posts as any[]).slice(0, 50), uid));
  });

  app.post("/api/posts", requireAuth, validateBody(postCreateSchema), async (req, res) => {
    const { image_url, caption, tags, spot_id } = req.body;
    const uid = req.authUser!.uid;
    const profile = await usersCol.doc(uid).get().then(s => s.data()).catch(() => mockUsers[uid]);
    const doc = {
      image_url,
      caption,
      tags,
      spot_id: spot_id ?? null,
      user_name: profile?.displayName || req.authUser!.email || "Anónimo",
      user_avatar: profile?.photoURL ?? null,
      createdBy: uid,
    };
    try {
      const ref = await postsCol.add({ ...doc, createdAt: FieldValue.serverTimestamp() });
      return res.json({ id: ref.id });
    } catch (firestoreErr) {
      console.warn("Firestore post add failed, using mock:", (firestoreErr as Error).message);
      const newPost = { id: `post-${Date.now()}`, ...doc, createdAt: new Date().toISOString() };
      mockPosts.unshift(newPost);
      return res.json({ id: newPost.id });
    }
  });

  app.delete("/api/posts/:id", requireAuth, validateIdParam, async (req, res) => {
    const uid = req.authUser!.uid;
    const postId = req.params.id;
    try {
      const snap = await postsCol.doc(postId).get();
      if (!snap.exists) return res.status(404).json({ error: "Post not found" });
      if (snap.data()?.createdBy !== uid) return res.status(403).json({ error: "No puedes borrar una publicación que no es tuya" });
      await postsCol.doc(postId).delete();
    } catch (firestoreErr) {
      const idx = mockPosts.findIndex((p: any) => p.id === postId);
      if (idx === -1) return res.status(404).json({ error: "Post not found" });
      if (mockPosts[idx].createdBy !== uid) return res.status(403).json({ error: "No puedes borrar una publicación que no es tuya" });
      mockPosts.splice(idx, 1);
    }
    res.json({ success: true });
  });

  app.post("/api/posts/:id/like", requireAuth, validateIdParam, async (req, res) => {
    const uid = req.authUser!.uid;
    const postId = req.params.id;
    try {
      const existing = await postLikesCol.where("createdBy", "==", uid).where("post_id", "==", postId).limit(1).get();
      if (existing.empty) await postLikesCol.add({ post_id: postId, createdBy: uid, createdAt: FieldValue.serverTimestamp() });
    } catch (firestoreErr) {
      if (!mockPostLikes.some((l: any) => l.createdBy === uid && l.post_id === postId)) {
        mockPostLikes.push({ id: `like-${Date.now()}`, post_id: postId, createdBy: uid, createdAt: new Date().toISOString() });
      }
    }
    res.json({ success: true });
  });

  app.delete("/api/posts/:id/like", requireAuth, validateIdParam, async (req, res) => {
    const uid = req.authUser!.uid;
    const postId = req.params.id;
    try {
      const existing = await postLikesCol.where("createdBy", "==", uid).where("post_id", "==", postId).get();
      await Promise.all(existing.docs.map(d => d.ref.delete()));
    } catch (firestoreErr) {
      const idx = mockPostLikes.findIndex((l: any) => l.createdBy === uid && l.post_id === postId);
      if (idx !== -1) mockPostLikes.splice(idx, 1);
    }
    res.json({ success: true });
  });

  app.get("/api/posts/:id/comments", validateIdParam, async (req, res) => {
    const rows = await readCollection(postCommentsCol.where("post_id", "==", req.params.id), mockPostComments.filter((c: any) => c.post_id === req.params.id));
    res.json(sortByNewest(rows as any[]).reverse());
  });

  app.post("/api/posts/:id/comments", requireAuth, validateIdParam, validateBody(postCommentCreateSchema), async (req, res) => {
    const uid = req.authUser!.uid;
    const profile = await usersCol.doc(uid).get().then(s => s.data()).catch(() => mockUsers[uid]);
    const doc = {
      post_id: req.params.id,
      text: req.body.text,
      user_name: profile?.displayName || req.authUser!.email || "Anónimo",
      user_avatar: profile?.photoURL ?? null,
      createdBy: uid,
    };
    try {
      const ref = await postCommentsCol.add({ ...doc, createdAt: FieldValue.serverTimestamp() });
      return res.json({ id: ref.id });
    } catch (firestoreErr) {
      const newComment = { id: `comment-${Date.now()}`, ...doc, createdAt: new Date().toISOString() };
      mockPostComments.push(newComment);
      return res.json({ id: newComment.id });
    }
  });

  // Perfil público de otro rider: sólo lo que esa persona ya publica en la
  // app (nombre, avatar, ciudad, bio, instagram) más sus aportes visibles.
  // Nunca el email, los favoritos ni nada privado del doc de usuario.
  app.get("/api/users/:id/public", validateIdParam, async (req, res) => {
    const targetUid = req.params.id;
    try {
      const profile = await usersCol.doc(targetUid).get().then(s => (s.exists ? s.data() : null)).catch(() => mockUsers[targetUid] ?? null);
      const [spots, posts, reviews] = await Promise.all([
        readCollection(spotsCol.where("createdBy", "==", targetUid), mockSpots.filter((s: any) => s.createdBy === targetUid)),
        readCollection(postsCol.where("createdBy", "==", targetUid), mockPosts.filter((p: any) => p.createdBy === targetUid)),
        readCollection(reviewsCol.where("createdBy", "==", targetUid), mockReviews.filter((r: any) => r.createdBy === targetUid)),
      ]);

      if (!profile && (spots as any[]).length === 0 && (posts as any[]).length === 0) {
        return res.status(404).json({ error: "Rider no encontrado" });
      }

      res.json({
        uid: targetUid,
        displayName: profile?.displayName ?? null,
        photoURL: profile?.photoURL ?? null,
        bannerURL: profile?.bannerURL ?? null,
        city: profile?.city ?? null,
        discipline: profile?.discipline ?? null,
        bio: profile?.bio ?? null,
        instagram: profile?.instagram ?? null,
        spotsCreated: (spots as any[]).length,
        postsCount: (posts as any[]).length,
        reviewsWritten: (reviews as any[]).length,
        spots: sortByNewest(spots as any[]).slice(0, 12),
        posts: sortByNewest(posts as any[]).slice(0, 12),
      });
    } catch (err) {
      console.error("Failed to build public profile:", err);
      res.status(500).json({ error: "Failed to build public profile" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
