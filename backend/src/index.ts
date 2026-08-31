import { crearApp } from "./app.js";
import { avisarModoAuth } from "./auth.js";
import { config } from "./config.js";
import { esperarBaseDeDatos, migrar, pool } from "./db.js";
import { sembrarEventosSiVacio } from "./routes/events.js";

async function arrancar() {
  console.log(`[api] urbanFlow · entorno ${config.entorno}`);

  await esperarBaseDeDatos();
  await migrar();

  if (config.sembrarEventos) {
    await sembrarEventosSiVacio();
  }

  avisarModoAuth();

  const app = crearApp();
  const servidor = app.listen(config.puerto, "0.0.0.0", () => {
    console.log(`[api] escuchando en http://localhost:${config.puerto}`);
    console.log(`[api] salud: http://localhost:${config.puerto}/api/health`);
  });

  // Docker manda SIGTERM al parar el contenedor. Sin esto, las conexiones
  // abiertas a Postgres se cortan de golpe y el reinicio deja sesiones
  // colgadas del lado del servidor.
  const apagar = (senal: string) => {
    console.log(`[api] ${senal} recibido, cerrando…`);
    servidor.close(() => {
      pool.end().then(() => {
        console.log("[api] cerrado limpiamente");
        process.exit(0);
      });
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => apagar("SIGTERM"));
  process.on("SIGINT", () => apagar("SIGINT"));
}

arrancar().catch((err) => {
  console.error("[api] fallo al arrancar:", err instanceof Error ? err.message : err);
  process.exit(1);
});
