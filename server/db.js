import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
pg.types.setTypeParser(1082, (valor) => valor);

const url = process.env.DATABASE_URL || "";
const usaSsl = url.includes("render.com") || process.env.PGSSL === "1";

export const pool = url
  ? new pg.Pool({
      connectionString: url,
      ssl: usaSsl ? { rejectUnauthorized: false } : undefined,
    })
  : null;

export function bancoPronto() {
  return Boolean(pool);
}

export async function garantirSchema() {
  if (!pool) return;
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
}

export async function query(texto, params = []) {
  if (!pool) throw new Error("DATABASE_URL não configurada");
  return pool.query(texto, params);
}

const SQL_VERSAO = `INSERT INTO sync_meta (id, versao) VALUES (1, 1)
  ON CONFLICT (id) DO UPDATE SET versao = sync_meta.versao + 1`;

export async function tocarVersao(cliente) {
  if (cliente) await cliente.query(SQL_VERSAO);
  else await query(SQL_VERSAO);
}

export async function comTransacao(fn) {
  if (!pool) throw new Error("DATABASE_URL não configurada");
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await fn(cliente);
    await cliente.query(SQL_VERSAO);
    await cliente.query("COMMIT");
    return resultado;
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
