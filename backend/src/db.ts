import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

// Postgres devuelve numeric/int8 como string para no perder precisión. En este
// esquema no hay valores que se salgan del rango seguro de JavaScript, y el
// frontend espera números en lat/lng, así que los convertimos.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export const pool = new Pool({
  connectionString: config.urlBaseDatos,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[db] error inesperado en una conexión inactiva:", err.message);
});

/**
 * Espera a que Postgres acepte conexiones. El contenedor de la API arranca
 * antes de que la base termine de inicializarse la primera vez, y el
 * healthcheck de Compose no siempre llega a tiempo.
 */
export async function esperarBaseDeDatos(intentos = 30, esperaMs = 1000): Promise<void> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      await pool.query("SELECT 1");
      console.log("[db] conectado");
      return;
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      if (intento === intentos) {
        throw new Error(`No se pudo conectar a Postgres tras ${intentos} intentos: ${mensaje}`);
      }
      console.log(`[db] esperando a Postgres (${intento}/${intentos})…`);
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
}

/**
 * Aplica los ficheros de src/migrations en orden alfabético, una sola vez.
 * Sin herramienta externa a propósito: son cuatro tablas y el proyecto todavía
 * no justifica una dependencia más.
 */
export async function migrar(): Promise<void> {
  const directorio = join(dirname(fileURLToPath(import.meta.url)), "migrations");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migraciones (
      nombre      text PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )
  `);

  const ficheros = (await readdir(directorio)).filter((f) => f.endsWith(".sql")).sort();

  for (const fichero of ficheros) {
    const yaAplicada = await pool.query("SELECT 1 FROM _migraciones WHERE nombre = $1", [fichero]);
    if (yaAplicada.rowCount) continue;

    const sql = await readFile(join(directorio, fichero), "utf8");
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query(sql);
      await cliente.query("INSERT INTO _migraciones (nombre) VALUES ($1)", [fichero]);
      await cliente.query("COMMIT");
      console.log(`[db] migración aplicada: ${fichero}`);
    } catch (err) {
      await cliente.query("ROLLBACK");
      throw new Error(
        `Falló la migración ${fichero}: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      cliente.release();
    }
  }
}
