import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { query } from "./db.js";

export const PERMISSOES_OPERADOR = {
  folha: true,
  destinos: true,
  sobras: true,
  porCliente: false,
  relatorios: false,
  cadastros: false,
};

export const PERMISSOES_TODAS = {
  folha: true,
  destinos: true,
  sobras: true,
  porCliente: true,
  relatorios: true,
  cadastros: true,
};

export const TRAVAS_PADRAO = {
  qtd: true,
  produtor: false,
  mercadoria: false,
  preco: false,
  destinos: false,
};

export const COLUNAS_FOLHA_TODAS = {
  produtor: true,
  qtd: true,
  qtdFeita: true,
  mercadoria: true,
  preco: true,
  destino: true,
};

export const COLUNAS_FOLHA_OPERADOR = {
  produtor: true,
  qtd: true,
  qtdFeita: true,
  mercadoria: true,
  preco: false,
  destino: true,
};

export class FalhaAuth extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(pin), salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verificarPin(pin, armazenado) {
  const [salHex, hashHex] = String(armazenado ?? "").split(":");
  if (!salHex || !hashHex) return false;
  try {
    const sal = Buffer.from(salHex, "hex");
    const esperado = Buffer.from(hashHex, "hex");
    const teste = scryptSync(String(pin), sal, esperado.length);
    return timingSafeEqual(esperado, teste);
  } catch {
    return false;
  }
}

export function pinValido(pin) {
  return /^\d{4,8}$/.test(String(pin ?? "").trim());
}

export function novoToken() {
  return randomBytes(24).toString("hex");
}

export function novoId(prefixo) {
  return `${prefixo}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export function normalizarNome(nome) {
  return String(nome ?? "").trim().replace(/\s+/g, " ");
}

export function mesclarColunas(papel, colunas) {
  if (papel === "responsavel") return { ...COLUNAS_FOLHA_TODAS };
  const base = { ...COLUNAS_FOLHA_OPERADOR };
  if (colunas && typeof colunas === "object") {
    for (const chave of Object.keys(base)) {
      if (typeof colunas[chave] === "boolean") base[chave] = colunas[chave];
    }
  }
  return base;
}

export function mesclarPermissoes(papel, permissoes) {
  const bruto = permissoes && typeof permissoes === "object" ? { ...permissoes } : {};
  const colunas = bruto.colunas;
  delete bruto.colunas;
  const flags = papel === "responsavel" ? { ...PERMISSOES_TODAS } : { ...PERMISSOES_OPERADOR, ...bruto };
  return {
    folha: Boolean(flags.folha),
    destinos: Boolean(flags.destinos),
    sobras: Boolean(flags.sobras),
    porCliente: Boolean(flags.porCliente),
    relatorios: Boolean(flags.relatorios),
    cadastros: Boolean(flags.cadastros),
    colunas: mesclarColunas(papel, colunas),
  };
}

export function mapUsuario(row, { comSessao = false, token } = {}) {
  if (!row) return null;
  const mesclado = mesclarPermissoes(row.papel, row.permissoes);
  const { colunas, ...permissoes } = mesclado;
  const usuario = {
    id: row.id,
    nome: row.nome,
    papel: row.papel === "responsavel" ? "responsavel" : "operador",
    ativo: row.ativo !== false,
    permissoes,
    visibilidadeFolha: colunas,
    criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : String(row.criado_em ?? ""),
  };
  if (comSessao) usuario.token = token;
  return usuario;
}

export function podeVerColuna(usuario, chave) {
  if (!usuario || usuario.papel === "responsavel") return true;
  const vis = usuario.visibilidadeFolha ?? COLUNAS_FOLHA_OPERADOR;
  return vis[chave] !== false;
}

export async function contarUsuarios() {
  const resultado = await query("SELECT COUNT(*)::int AS n FROM usuarios");
  return Number(resultado.rows[0]?.n ?? 0);
}

export async function sistemaConfigurado() {
  return (await contarUsuarios()) > 0;
}

const ADMINISTRADORES_INICIAIS = [
  { nome: "Keila", pin: "12345" },
  { nome: "Italo", pin: "12345" },
  { nome: "Joni", pin: "12345" },
];

export async function semearAdministradores() {
  const permissoes = JSON.stringify(mesclarPermissoes("responsavel", {}));
  const criados = [];
  for (const pessoa of ADMINISTRADORES_INICIAIS) {
    const existe = await query(
      "SELECT id FROM usuarios WHERE lower(nome) = lower($1) LIMIT 1",
      [pessoa.nome],
    );
    if (existe.rows.length) continue;
    const id = novoId("usr");
    await query(
      `INSERT INTO usuarios (id, nome, pin_hash, papel, ativo, permissoes)
       VALUES ($1, $2, $3, 'responsavel', TRUE, $4::jsonb)`,
      [id, pessoa.nome, hashPin(pessoa.pin), permissoes],
    );
    criados.push(pessoa.nome);
  }
  if (!criados.length) return;
  await gravarAuditoria({
    usuario: { id: "sistema", nome: "sistema" },
    acao: "seed_admin",
    detalhe: { nomes: criados },
  });
  console.log(`Administradores no banco: ${criados.join(", ")}`);
}

export async function lerTravas() {
  const resultado = await query("SELECT travas FROM config_sistema WHERE id = 1");
  return { ...TRAVAS_PADRAO, ...(resultado.rows[0]?.travas ?? {}) };
}

export async function gravarAuditoria({
  usuario,
  autorizadoPor,
  acao,
  alvo,
  detalhe,
}) {
  await query(
    `INSERT INTO auditoria (id, usuario_id, usuario_nome, autorizado_por_id, autorizado_por_nome, acao, alvo, detalhe)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      novoId("aud"),
      usuario?.id ?? null,
      usuario?.nome ?? "",
      autorizadoPor?.id ?? null,
      autorizadoPor?.nome ?? null,
      acao,
      alvo ?? null,
      JSON.stringify(detalhe ?? {}),
    ],
  );
}

export async function criarSessao(usuarioId) {
  const token = novoToken();
  await query(
    "INSERT INTO sessoes (token, usuario_id, expira_em) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
    [token, usuarioId],
  );
  return token;
}

export async function usuarioDaSessao(token) {
  if (!token) return null;
  const resultado = await query(
    `SELECT u.* FROM sessoes s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token = $1 AND s.expira_em > NOW() AND u.ativo = TRUE`,
    [token],
  );
  return resultado.rows[0] ?? null;
}

export function extrairToken(req) {
  const header = String(req.headers.authorization ?? "");
  const bearer = header.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();
  return String(req.headers["x-galpao-token"] ?? "").trim() || null;
}

export function exigirAuth({ opcional = false } = {}) {
  return async (req, res, next) => {
    try {
      if (!(await sistemaConfigurado())) {
        req.usuario = null;
        req.authOpcional = true;
        next();
        return;
      }
      const row = await usuarioDaSessao(extrairToken(req));
      if (!row) {
        if (opcional) {
          req.usuario = null;
          next();
          return;
        }
        res.status(401).json({ erro: "Entre com seu cadastro para continuar." });
        return;
      }
      req.usuario = mapUsuario(row);
      next();
    } catch (erro) {
      next(erro);
    }
  };
}

export function exigirResponsavel(req, res, next) {
  if (req.authOpcional && !req.usuario) {
    next();
    return;
  }
  if (req.usuario?.papel !== "responsavel") {
    res.status(403).json({ erro: "Só o responsável pode fazer isso." });
    return;
  }
  next();
}

export function exigirPermissao(chave) {
  return (req, res, next) => {
    if (req.authOpcional && !req.usuario) {
      next();
      return;
    }
    if (req.usuario?.papel === "responsavel" || req.usuario?.permissoes?.[chave]) {
      next();
      return;
    }
    res.status(403).json({ erro: "Você não tem permissão para isso." });
  };
}

export function campoLancado(entrada, campo) {
  if (!entrada) return false;
  if (campo === "qtd") return Number(entrada.qtd) > 0;
  if (campo === "produtor") return Boolean(String(entrada.produtor ?? "").trim());
  if (campo === "mercadoria") return Boolean(String(entrada.mercadoria ?? "").trim());
  if (campo === "preco") {
    return (Number(entrada.preco) > 0) || (Number(entrada.precoFraco) > 0);
  }
  if (campo === "destinos") {
    return Array.isArray(entrada.destinos) && entrada.destinos.length > 0;
  }
  return false;
}

export function valorCampo(entrada, campo) {
  if (campo === "qtd") return Number(entrada?.qtd) || 0;
  if (campo === "produtor") return String(entrada?.produtor ?? "").trim();
  if (campo === "mercadoria") return String(entrada?.mercadoria ?? "").trim();
  if (campo === "preco") {
    return { preco: entrada?.preco ?? null, precoFraco: entrada?.precoFraco ?? null };
  }
  if (campo === "destinos") {
    return (entrada?.destinos ?? []).map((d) => ({
      id: d.id,
      cliente: d.cliente,
      tipo: d.tipo,
      boa: d.boa,
      fraca: d.fraca,
      perda: d.perda,
    }));
  }
  return null;
}

export function campoMudou(antes, depois, campo) {
  return JSON.stringify(valorCampo(antes, campo)) !== JSON.stringify(valorCampo(depois, campo));
}
