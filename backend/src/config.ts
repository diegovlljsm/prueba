import "dotenv/config";

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copia .env.example a .env en la raíz del proyecto.`
    );
  }
  return valor;
}

const modoAuth = (process.env.AUTH_MODE ?? "dev") as "dev" | "firebase";

if (modoAuth !== "dev" && modoAuth !== "firebase") {
  throw new Error(`AUTH_MODE debe ser "dev" o "firebase", no "${modoAuth}".`);
}

const entorno = process.env.NODE_ENV ?? "development";

// El modo dev no verifica la firma de los tokens. Dejarlo activo en producción
// significa que cualquiera puede hacerse pasar por administrador enviando un
// JWT inventado, así que el proceso no arranca.
if (entorno === "production" && modoAuth === "dev") {
  throw new Error(
    "AUTH_MODE=dev no puede usarse con NODE_ENV=production: no verifica la firma de los tokens."
  );
}

export const config = {
  entorno,
  puerto: Number(process.env.PORT ?? 8080),
  urlBaseDatos: requerido("DATABASE_URL"),
  modoAuth,
  /** Correos que reciben rol de administrador la primera vez que entran. */
  correosAdmin: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean),
  origenesPermitidos: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  /** Solo se usa con AUTH_MODE=firebase. */
  proyectoFirebase: process.env.FIREBASE_PROJECT_ID ?? "",
  /** Siembra los eventos de ejemplo si la tabla está vacía. */
  sembrarEventos: process.env.SEED_EVENTS !== "false",
} as const;
