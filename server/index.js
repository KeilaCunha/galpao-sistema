import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  campoLancado,
  campoMudou,
  criarSessao,
  exigirAuth,
  exigirPermissao,
  exigirResponsavel,
  FalhaAuth,
  gravarAuditoria,
  hashPin,
  lerTravas,
  mapUsuario,
  mesclarPermissoes,
  normalizarNome,
  podeVerColuna,
  novoId,
  novoToken,
  pinValido,
  semearAdministradores,
  sistemaConfigurado,
  TRAVAS_PADRAO,
  verificarPin,
} from "./auth.js";
import { bancoPronto, comTransacao, garantirSchema, query, tocarVersao } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const porta = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function numero(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function destinoPreenchido(destino) {
  if (
    (numero(destino?.boa) ?? 0) > 0 ||
    (numero(destino?.fraca) ?? 0) > 0 ||
    (numero(destino?.perda) ?? 0) > 0 ||
    String(destino?.motivo ?? "").trim()
  ) {
    return true;
  }
  const cliente = String(destino?.cliente ?? "").trim();
  if (!cliente) return false;
  const tipo = String(destino?.tipo ?? "").trim().toLowerCase();
  if (tipo === "estoque" || cliente.toLowerCase() === "estoque") return false;
  return true;
}

function isoData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function mapFornecedor(row) {
  return {
    id: row.id,
    nome: row.nome,
    documento: row.documento,
    telefone: row.telefone,
    email: row.email,
    cidade: row.cidade,
    endereco: row.endereco,
    observacoes: row.observacoes,
    criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : String(row.criado_em ?? ""),
  };
}

function mapProduto(row) {
  return {
    id: row.id,
    nome: row.nome,
    classificacaoId: row.classificacao_id || undefined,
    unidade: row.unidade,
    estoqueAtual: Number(row.estoque_atual) || 0,
    estoqueMinimo: Number(row.estoque_minimo) || 0,
    descricao: row.descricao,
    situacao: row.situacao,
    tipos: row.tipos ?? [],
  };
}

function mapCliente(row) {
  return {
    id: row.id,
    nome: row.nome,
    documento: row.documento,
    telefone: row.telefone,
    email: row.email,
    cidade: row.cidade,
    endereco: row.endereco,
    observacoes: row.observacoes,
    criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : String(row.criado_em ?? ""),
  };
}

function mapDestino(row) {
  return {
    id: row.id,
    cliente: row.cliente,
    tipo: row.tipo || "",
    data: isoData(row.data) || undefined,
    origem: row.origem === "estoque" ? "estoque" : "folha",
    boa: numero(row.boa),
    fraca: numero(row.fraca),
    perda: numero(row.perda),
    motivo: row.motivo || undefined,
    saidaId: row.saida_id || undefined,
  };
}

function mapEntrada(row, destinos = []) {
  return {
    id: row.id,
    data: isoData(row.data),
    produtor: row.produtor,
    mercadoria: row.mercadoria,
    qtd: Number(row.qtd) || 0,
    preco: numero(row.preco),
    precoFraco: numero(row.preco_fraco),
    rendimentoExtra: numero(row.rendimento_extra) || undefined,
    destinos,
  };
}

function permissoesDoPedido(papel, body, atuais) {
  const origem = body?.permissoes ?? atuais ?? {};
  return mesclarPermissoes(papel, {
    ...origem,
    colunas: body?.visibilidadeFolha ?? origem.colunas,
  });
}

function entradasParaUsuario(usuario, entradas) {
  if (podeVerColuna(usuario, "preco")) return entradas;
  return entradas.map((entrada) => ({ ...entrada, preco: null, precoFraco: null }));
}

async function exigirBanco(_req, res, next) {
  if (!bancoPronto()) {
    res.status(503).json({ erro: "Banco de dados não configurado. Defina DATABASE_URL." });
    return;
  }
  next();
}

const autenticado = [exigirBanco, exigirAuth()];
const soResponsavel = [...autenticado, exigirResponsavel];

async function localizarUsuarioPorNome(nome) {
  const resultado = await query(
    "SELECT * FROM usuarios WHERE lower(nome) = lower($1) LIMIT 1",
    [normalizarNome(nome)],
  );
  return resultado.rows[0] ?? null;
}

async function responderSessao(res, row, token) {
  const travas = await lerTravas();
  res.json({ usuario: mapUsuario(row, { comSessao: true, token }), travas });
}

async function carregarEntradas() {
  const entradas = await query("SELECT * FROM entradas ORDER BY data, id");
  const destinos = await query("SELECT * FROM destinos ORDER BY id");
  const porEntrada = new Map();
  for (const destino of destinos.rows) {
    const mapeado = mapDestino(destino);
    if (!destinoPreenchido(mapeado)) continue;
    const lista = porEntrada.get(destino.entrada_id) ?? [];
    lista.push(mapeado);
    porEntrada.set(destino.entrada_id, lista);
  }
  return entradas.rows.map((row) => mapEntrada(row, porEntrada.get(row.id) ?? []));
}

async function montarPacote() {
  const [entradas, fornecedores, produtos, clientes] = await Promise.all([
    carregarEntradas(),
    query("SELECT * FROM fornecedores ORDER BY nome"),
    query("SELECT * FROM produtos ORDER BY nome"),
    query("SELECT * FROM clientes ORDER BY nome"),
  ]);
  return {
    geradoEm: new Date().toISOString(),
    entradas,
    fornecedores: fornecedores.rows.map(mapFornecedor),
    produtos: produtos.rows.map(mapProduto),
    clientes: clientes.rows.map(mapCliente),
  };
}

let backupEmAndamento = false;

async function garantirBackupDoDia() {
  if (!bancoPronto() || backupEmAndamento) return;
  backupEmAndamento = true;
  try {
    const hoje = await query(
      "SELECT 1 FROM copias_seguranca WHERE criado_em::date = CURRENT_DATE LIMIT 1",
    );
    if (hoje.rows.length) return;
    const pacote = await montarPacote();
    await query("INSERT INTO copias_seguranca (id, payload) VALUES ($1, $2::jsonb)", [
      `bkp-${Date.now()}`,
      JSON.stringify(pacote),
    ]);
    await query("DELETE FROM copias_seguranca WHERE criado_em < NOW() - INTERVAL '365 days'");
  } catch (erro) {
    console.error("Cópia de segurança do dia:", erro);
  } finally {
    backupEmAndamento = false;
  }
}

app.get("/api/health", wrap(async (_req, res) => {
  if (!bancoPronto()) {
    res.json({ ok: true, db: false });
    return;
  }
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: true });
  } catch (erro) {
    res.status(500).json({ ok: false, db: false, erro: String(erro.message || erro) });
  }
}));

app.get("/api/auth/estado", wrap(async (_req, res) => {
  if (!bancoPronto()) {
    res.json({ db: false, configurado: false });
    return;
  }
  try {
    await query("SELECT 1");
    res.json({ db: true, configurado: await sistemaConfigurado() });
  } catch {
    res.json({ db: false, configurado: false });
  }
}));

app.post("/api/auth/setup", exigirBanco, wrap(async (req, res) => {
  if (await sistemaConfigurado()) {
    throw new FalhaAuth(409, "O sistema já tem um responsável. Entre com o cadastro.");
  }
  const nome = normalizarNome(req.body?.nome);
  const pin = String(req.body?.pin ?? "").trim();
  if (nome.length < 2) throw new FalhaAuth(400, "Informe o nome do responsável.");
  if (!pinValido(pin)) throw new FalhaAuth(400, "A senha precisa ter de 4 a 8 números.");
  const id = novoId("usr");
  await query(
    `INSERT INTO usuarios (id, nome, pin_hash, papel, ativo, permissoes)
     VALUES ($1, $2, $3, 'responsavel', TRUE, '{}'::jsonb)`,
    [id, nome, hashPin(pin)],
  );
  const token = await criarSessao(id);
  const row = await query("SELECT * FROM usuarios WHERE id = $1", [id]);
  await gravarAuditoria({ usuario: mapUsuario(row.rows[0]), acao: "setup", alvo: id, detalhe: { nome } });
  await responderSessao(res, row.rows[0], token);
}));

app.post("/api/auth/login", exigirBanco, wrap(async (req, res) => {
  const row = await localizarUsuarioPorNome(req.body?.nome);
  if (!row || !row.ativo || !verificarPin(req.body?.pin, row.pin_hash)) {
    throw new FalhaAuth(401, "Nome ou senha não conferem.");
  }
  const token = await criarSessao(row.id);
  await gravarAuditoria({ usuario: mapUsuario(row), acao: "login", alvo: row.id });
  await responderSessao(res, row, token);
}));

app.post("/api/auth/logout", exigirBanco, wrap(async (req, res) => {
  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token) await query("DELETE FROM sessoes WHERE token = $1", [token]);
  res.json({ ok: true });
}));

app.get("/api/auth/eu", ...autenticado, wrap(async (req, res) => {
  const travas = await lerTravas();
  res.json({ usuario: req.usuario, travas, configurado: true });
}));

app.post("/api/auth/autorizar", ...autenticado, wrap(async (req, res) => {
  if (!req.usuario) throw new FalhaAuth(401, "Entre com seu cadastro para continuar.");
  const row = await localizarUsuarioPorNome(req.body?.nome);
  if (!row || !row.ativo || row.papel !== "responsavel" || !verificarPin(req.body?.pin, row.pin_hash)) {
    throw new FalhaAuth(401, "Senha do responsável não confere.");
  }
  const campos = Array.isArray(req.body?.campos)
    ? req.body.campos.filter((campo) => ["qtd", "produtor", "mercadoria", "preco", "destinos"].includes(campo))
    : ["qtd"];
  const token = novoToken();
  await query(
    `INSERT INTO autorizacoes (token, usuario_id, entrada_id, campos, expira_em)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
    [token, row.id, req.body?.entradaId ?? null, campos],
  );
  const autorizadoPor = mapUsuario(row);
  await gravarAuditoria({
    usuario: req.usuario,
    autorizadoPor,
    acao: "autorizar",
    alvo: req.body?.entradaId ?? null,
    detalhe: { campos, por: autorizadoPor.nome },
  });
  res.json({ token, campos, autorizadoPor, expiraEm: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
}));

app.get("/api/usuarios", ...soResponsavel, wrap(async (_req, res) => {
  const resultado = await query("SELECT * FROM usuarios ORDER BY criado_em, nome");
  res.json(resultado.rows.map((row) => mapUsuario(row)));
}));

app.post("/api/usuarios", ...soResponsavel, wrap(async (req, res) => {
  const nome = normalizarNome(req.body?.nome);
  const pin = String(req.body?.pin ?? "").trim();
  const papel = req.body?.papel === "responsavel" ? "responsavel" : "operador";
  if (nome.length < 2) throw new FalhaAuth(400, "Informe o nome da pessoa.");
  if (!pinValido(pin)) throw new FalhaAuth(400, "A senha precisa ter de 4 a 8 números.");
  if (await localizarUsuarioPorNome(nome)) throw new FalhaAuth(409, "Já existe alguém com esse nome.");
  const id = novoId("usr");
  const permissoes = permissoesDoPedido(papel, req.body);
  await query(
    `INSERT INTO usuarios (id, nome, pin_hash, papel, ativo, permissoes)
     VALUES ($1, $2, $3, $4, TRUE, $5::jsonb)`,
    [id, nome, hashPin(pin), papel, JSON.stringify(permissoes)],
  );
  const row = await query("SELECT * FROM usuarios WHERE id = $1", [id]);
  await gravarAuditoria({
    usuario: req.usuario,
    acao: "criar_usuario",
    alvo: id,
    detalhe: { nome, papel },
  });
  res.json(mapUsuario(row.rows[0]));
}));

app.put("/api/usuarios/:id", ...soResponsavel, wrap(async (req, res) => {
  const atual = await query("SELECT * FROM usuarios WHERE id = $1", [req.params.id]);
  const row = atual.rows[0];
  if (!row) throw new FalhaAuth(404, "Pessoa não encontrada.");
  const nome = normalizarNome(req.body?.nome ?? row.nome);
  const papel = req.body?.papel === "responsavel" ? "responsavel" : req.body?.papel === "operador" ? "operador" : row.papel;
  const ativo = req.body?.ativo == null ? row.ativo : Boolean(req.body.ativo);
  if (row.papel === "responsavel" && (papel !== "responsavel" || !ativo)) {
    const outros = await query(
      "SELECT COUNT(*)::int AS n FROM usuarios WHERE papel = 'responsavel' AND ativo = TRUE AND id <> $1",
      [row.id],
    );
    if (Number(outros.rows[0]?.n ?? 0) === 0) {
      throw new FalhaAuth(400, "Precisa ficar pelo menos um responsável ativo.");
    }
  }
  const duplicado = await query(
    "SELECT 1 FROM usuarios WHERE lower(nome) = lower($1) AND id <> $2",
    [nome, row.id],
  );
  if (duplicado.rows.length) throw new FalhaAuth(409, "Já existe alguém com esse nome.");
  const pin = String(req.body?.pin ?? "").trim();
  const pinHash = pin ? (pinValido(pin) ? hashPin(pin) : null) : row.pin_hash;
  if (pin && !pinHash) throw new FalhaAuth(400, "A senha precisa ter de 4 a 8 números.");
  const permissoes = permissoesDoPedido(papel, req.body, row.permissoes);
  await query(
    `UPDATE usuarios SET nome = $2, pin_hash = $3, papel = $4, ativo = $5, permissoes = $6::jsonb WHERE id = $1`,
    [row.id, nome, pinHash, papel, ativo, JSON.stringify(permissoes)],
  );
  if (pin) await query("DELETE FROM sessoes WHERE usuario_id = $1", [row.id]);
  const salvo = await query("SELECT * FROM usuarios WHERE id = $1", [row.id]);
  await gravarAuditoria({
    usuario: req.usuario,
    acao: "alterar_usuario",
    alvo: row.id,
    detalhe: { nome, papel, ativo },
  });
  res.json(mapUsuario(salvo.rows[0]));
}));

app.get("/api/config/travas", ...autenticado, wrap(async (_req, res) => {
  res.json(await lerTravas());
}));

app.put("/api/config/travas", ...soResponsavel, wrap(async (req, res) => {
  const atual = await lerTravas();
  const travas = { ...TRAVAS_PADRAO, ...atual, ...(req.body ?? {}) };
  await query("UPDATE config_sistema SET travas = $1::jsonb WHERE id = 1", [JSON.stringify(travas)]);
  await gravarAuditoria({ usuario: req.usuario, acao: "alterar_travas", detalhe: travas });
  res.json(travas);
}));

app.get("/api/auditoria", ...soResponsavel, wrap(async (req, res) => {
  const limite = Math.min(200, Math.max(20, Number(req.query.limite) || 80));
  const resultado = await query(
    `SELECT id, criado_em, usuario_nome, autorizado_por_nome, acao, alvo, detalhe
     FROM auditoria ORDER BY criado_em DESC LIMIT $1`,
    [limite],
  );
  res.json(
    resultado.rows.map((row) => ({
      id: row.id,
      criadoEm: row.criado_em instanceof Date ? row.criado_em.toISOString() : String(row.criado_em),
      usuarioNome: row.usuario_nome,
      autorizadoPorNome: row.autorizado_por_nome,
      acao: row.acao,
      alvo: row.alvo,
      detalhe: row.detalhe ?? {},
    })),
  );
}));

app.get("/api/versao", ...autenticado, wrap(async (_req, res) => {
  const meta = await query("SELECT versao FROM sync_meta WHERE id = 1");
  res.json({ versao: Number(meta.rows[0]?.versao ?? 0) });
}));

app.get("/api/sync", ...autenticado, wrap(async (req, res) => {
  const [meta, entradas, fornecedores, produtos, clientes] = await Promise.all([
    query("SELECT versao FROM sync_meta WHERE id = 1"),
    carregarEntradas(),
    query("SELECT * FROM fornecedores ORDER BY nome"),
    query("SELECT * FROM produtos ORDER BY nome"),
    query("SELECT * FROM clientes ORDER BY nome"),
  ]);
  res.json({
    versao: Number(meta.rows[0]?.versao ?? 0),
    entradas: entradasParaUsuario(req.usuario, entradas),
    fornecedores: fornecedores.rows.map(mapFornecedor),
    produtos: produtos.rows.map(mapProduto),
    clientes: clientes.rows.map(mapCliente),
  });
  void garantirBackupDoDia();
}));

app.get("/api/backup", ...autenticado, exigirPermissao("relatorios"), wrap(async (_req, res) => {
  await garantirBackupDoDia();
  const ultimo = await query(
    "SELECT payload, criado_em FROM copias_seguranca ORDER BY criado_em DESC LIMIT 1",
  );
  const pacote = ultimo.rows[0]?.payload ?? (await montarPacote());
  const dia = isoData(ultimo.rows[0]?.criado_em) || isoData(new Date());
  res.setHeader("Content-Disposition", `attachment; filename="galpao-backup-${dia}.json"`);
  res.json(pacote);
}));

app.get("/api/planilha", ...autenticado, wrap(async (req, res) => {
  res.json({ entradas: entradasParaUsuario(req.usuario, await carregarEntradas()) });
}));

app.put("/api/entradas/:id", ...autenticado, wrap(async (req, res) => {
  const { id } = req.params;
  const body = req.body ?? {};
  let destinos = Array.isArray(body.destinos) ? body.destinos.filter(destinoPreenchido) : [];
  const nova = {
    id,
    data: isoData(body.data),
    produtor: body.produtor ?? "",
    mercadoria: body.mercadoria ?? "",
    qtd: numero(body.qtd) ?? 0,
    preco: numero(body.preco),
    precoFraco: numero(body.precoFraco),
    rendimentoExtra: numero(body.rendimentoExtra),
    destinos,
  };
  const antigas = await carregarEntradas();
  const antiga = antigas.find((entrada) => entrada.id === id);
  if (req.usuario && req.usuario.papel !== "responsavel" && antiga) {
    if (!podeVerColuna(req.usuario, "produtor")) nova.produtor = antiga.produtor;
    if (!podeVerColuna(req.usuario, "mercadoria")) nova.mercadoria = antiga.mercadoria;
    if (!podeVerColuna(req.usuario, "qtd")) nova.qtd = antiga.qtd;
    if (!podeVerColuna(req.usuario, "preco")) {
      nova.preco = antiga.preco;
      nova.precoFraco = antiga.precoFraco;
    }
  }
  const travas = await lerTravas();
  const operador = req.usuario && req.usuario.papel !== "responsavel";
  let autorizadoPor = null;
  if (operador) {
    const tokenAut = String(body.autorizacaoToken ?? "").trim();
    const liberados = new Set();
    if (tokenAut) {
      const aut = await query(
        `SELECT a.*, u.id AS uid, u.nome, u.papel, u.ativo, u.permissoes, u.criado_em
         FROM autorizacoes a JOIN usuarios u ON u.id = a.usuario_id
         WHERE a.token = $1 AND a.usado = FALSE AND a.expira_em > NOW()`,
        [tokenAut],
      );
      const row = aut.rows[0];
      if (row && (!row.entrada_id || row.entrada_id === id) && row.papel === "responsavel") {
        for (const campo of row.campos ?? []) liberados.add(campo);
        autorizadoPor = mapUsuario({
          id: row.uid,
          nome: row.nome,
          papel: row.papel,
          ativo: row.ativo,
          permissoes: row.permissoes,
          criado_em: row.criado_em,
        });
        await query("UPDATE autorizacoes SET usado = TRUE WHERE token = $1", [tokenAut]);
      }
    }
    const campos = ["qtd", "produtor", "mercadoria", "preco", "destinos"];
    const bloqueados = campos.filter(
      (campo) =>
        travas[campo] &&
        campoLancado(antiga, campo) &&
        campoMudou(antiga ?? {}, nova, campo) &&
        !liberados.has(campo),
    );
    if (bloqueados.length) {
      throw new FalhaAuth(403, "Esse lançamento já foi gravado. Peça a senha do responsável para alterar.");
    }
  }
  const mudancas = ["qtd", "produtor", "mercadoria", "preco", "destinos"]
    .filter((campo) => campoMudou(antiga ?? {}, nova, campo))
    .map((campo) => ({
      campo,
      de: antiga ? (campo === "destinos" ? antiga.destinos : antiga[campo === "preco" ? "preco" : campo]) : null,
      para: campo === "destinos" ? nova.destinos : campo === "preco" ? { preco: nova.preco, precoFraco: nova.precoFraco } : nova[campo],
    }));
  await comTransacao(async (cliente) => {
    await cliente.query(
      `INSERT INTO entradas (id, data, produtor, mercadoria, qtd, preco, preco_fraco, rendimento_extra, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         data = EXCLUDED.data,
         produtor = EXCLUDED.produtor,
         mercadoria = EXCLUDED.mercadoria,
         qtd = EXCLUDED.qtd,
         preco = EXCLUDED.preco,
         preco_fraco = EXCLUDED.preco_fraco,
         rendimento_extra = EXCLUDED.rendimento_extra,
         atualizado_em = NOW()`,
      [
        id,
        nova.data,
        nova.produtor ?? "",
        nova.mercadoria ?? "",
        numero(nova.qtd) ?? 0,
        numero(nova.preco),
        numero(nova.precoFraco),
        numero(nova.rendimentoExtra),
      ],
    );
    await cliente.query("DELETE FROM destinos WHERE entrada_id = $1", [id]);
    for (const destino of destinos) {
      if (!destino?.id || !destinoPreenchido(destino)) continue;
      await cliente.query(
        `INSERT INTO destinos (id, entrada_id, cliente, tipo, data, origem, boa, fraca, perda, motivo, saida_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          destino.id,
          id,
          destino.cliente ?? "",
          destino.tipo ?? "",
          isoData(destino.data),
          destino.origem === "estoque" ? "estoque" : "folha",
          numero(destino.boa),
          numero(destino.fraca),
          numero(destino.perda),
          destino.motivo ?? null,
          destino.saidaId ?? null,
        ],
      );
    }
  });
  if (mudancas.length && req.usuario) {
    await gravarAuditoria({
      usuario: req.usuario,
      autorizadoPor,
      acao: antiga ? "alterar_entrada" : "lancar_entrada",
      alvo: id,
      detalhe: { mudancas, produtor: nova.produtor, mercadoria: nova.mercadoria },
    });
  }
  res.json({ ok: true, id });
}));

app.delete("/api/entradas/:id", ...autenticado, wrap(async (req, res) => {
  const antigas = await carregarEntradas();
  const antiga = antigas.find((entrada) => entrada.id === req.params.id);
  const operador = req.usuario && req.usuario.papel !== "responsavel";
  if (operador && antiga && (Number(antiga.qtd) > 0 || antiga.produtor || antiga.mercadoria)) {
    throw new FalhaAuth(403, "Peça ao responsável para apagar um lançamento já gravado.");
  }
  await query("DELETE FROM entradas WHERE id = $1", [req.params.id]);
  await tocarVersao();
  if (req.usuario) {
    await gravarAuditoria({
      usuario: req.usuario,
      acao: "apagar_entrada",
      alvo: req.params.id,
      detalhe: { produtor: antiga?.produtor, mercadoria: antiga?.mercadoria, qtd: antiga?.qtd },
    });
  }
  res.json({ ok: true });
}));

function rotasCadastro(caminho, tabela, mapRow, paraLinha) {
  app.get(`/api/${caminho}`, ...autenticado, wrap(async (_req, res) => {
    const resultado = await query(`SELECT * FROM ${tabela} ORDER BY nome`);
    res.json(resultado.rows.map(mapRow));
  }));

  app.put(`/api/${caminho}/:id`, ...autenticado, exigirPermissao("cadastros"), wrap(async (req, res) => {
    const { texto, valores } = paraLinha(req.params.id, req.body ?? {});
    await query(texto, valores);
    await tocarVersao();
    if (req.usuario) {
      await gravarAuditoria({
        usuario: req.usuario,
        acao: "salvar_cadastro",
        alvo: `${caminho}:${req.params.id}`,
        detalhe: { nome: req.body?.nome },
      });
    }
    res.json({ ok: true, id: req.params.id });
  }));

  app.delete(`/api/${caminho}/:id`, ...autenticado, exigirPermissao("cadastros"), wrap(async (req, res) => {
    await query(`DELETE FROM ${tabela} WHERE id = $1`, [req.params.id]);
    await tocarVersao();
    res.json({ ok: true });
  }));
}

rotasCadastro("fornecedores", "fornecedores", mapFornecedor, (id, body) => ({
  texto: `INSERT INTO fornecedores (id, nome, documento, telefone, email, cidade, endereco, observacoes, criado_em)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()))
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome, documento = EXCLUDED.documento, telefone = EXCLUDED.telefone,
            email = EXCLUDED.email, cidade = EXCLUDED.cidade, endereco = EXCLUDED.endereco,
            observacoes = EXCLUDED.observacoes`,
  valores: [
    id,
    body.nome ?? "",
    body.documento ?? "",
    body.telefone ?? "",
    body.email ?? "",
    body.cidade ?? "",
    body.endereco ?? "",
    body.observacoes ?? "",
    body.criadoEm ?? null,
  ],
}));

rotasCadastro("produtos", "produtos", mapProduto, (id, body) => ({
  texto: `INSERT INTO produtos (id, nome, classificacao_id, unidade, estoque_atual, estoque_minimo, descricao, situacao, tipos)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome, classificacao_id = EXCLUDED.classificacao_id, unidade = EXCLUDED.unidade,
            estoque_atual = EXCLUDED.estoque_atual, estoque_minimo = EXCLUDED.estoque_minimo,
            descricao = EXCLUDED.descricao, situacao = EXCLUDED.situacao, tipos = EXCLUDED.tipos`,
  valores: [
    id,
    body.nome ?? "",
    body.classificacaoId ?? null,
    body.unidade ?? "caixa",
    numero(body.estoqueAtual) ?? 0,
    numero(body.estoqueMinimo) ?? 0,
    body.descricao ?? "",
    body.situacao ?? "ativo",
    Array.isArray(body.tipos) ? body.tipos : [],
  ],
}));

rotasCadastro("clientes", "clientes", mapCliente, (id, body) => ({
  texto: `INSERT INTO clientes (id, nome, documento, telefone, email, cidade, endereco, observacoes, criado_em)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()))
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome, documento = EXCLUDED.documento, telefone = EXCLUDED.telefone,
            email = EXCLUDED.email, cidade = EXCLUDED.cidade, endereco = EXCLUDED.endereco,
            observacoes = EXCLUDED.observacoes`,
  valores: [
    id,
    body.nome ?? "",
    body.documento ?? "",
    body.telefone ?? "",
    body.email ?? "",
    body.cidade ?? "",
    body.endereco ?? "",
    body.observacoes ?? "",
    body.criadoEm ?? null,
  ],
}));

const dist = path.join(__dirname, "..", "dist");
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (req, res, next) => {
  if (req.method !== "GET") return next();
  res.sendFile(path.join(dist, "index.html"), (erro) => {
    if (erro) next();
  });
});

app.use((erro, _req, res, _next) => {
  const status = Number(erro.status) || 500;
  if (status >= 500) console.error(erro);
  res.status(status).json({ erro: String(erro.message || erro) });
});

const servidor = app.listen(porta, async () => {
  try {
    await garantirSchema();
    if (bancoPronto()) await semearAdministradores();
    void garantirBackupDoDia();
    console.log(`API pronta em http://localhost:${porta} · banco ${bancoPronto() ? "ok" : "ausente"}`);
  } catch (erro) {
    console.error("Não foi possível preparar o banco:", erro);
  }
});

process.on("SIGTERM", () => servidor.close());
