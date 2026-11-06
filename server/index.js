import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

async function exigirBanco(_req, res, next) {
  if (!bancoPronto()) {
    res.status(503).json({ erro: "Banco de dados não configurado. Defina DATABASE_URL." });
    return;
  }
  next();
}

async function carregarEntradas() {
  const entradas = await query("SELECT * FROM entradas ORDER BY data, id");
  const destinos = await query("SELECT * FROM destinos ORDER BY id");
  const porEntrada = new Map();
  for (const destino of destinos.rows) {
    const lista = porEntrada.get(destino.entrada_id) ?? [];
    lista.push(mapDestino(destino));
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

app.get("/api/versao", exigirBanco, wrap(async (_req, res) => {
  const meta = await query("SELECT versao FROM sync_meta WHERE id = 1");
  res.json({ versao: Number(meta.rows[0]?.versao ?? 0) });
}));

app.get("/api/sync", exigirBanco, wrap(async (_req, res) => {
  const [meta, entradas, fornecedores, produtos, clientes] = await Promise.all([
    query("SELECT versao FROM sync_meta WHERE id = 1"),
    carregarEntradas(),
    query("SELECT * FROM fornecedores ORDER BY nome"),
    query("SELECT * FROM produtos ORDER BY nome"),
    query("SELECT * FROM clientes ORDER BY nome"),
  ]);
  res.json({
    versao: Number(meta.rows[0]?.versao ?? 0),
    entradas,
    fornecedores: fornecedores.rows.map(mapFornecedor),
    produtos: produtos.rows.map(mapProduto),
    clientes: clientes.rows.map(mapCliente),
  });
  void garantirBackupDoDia();
}));

app.get("/api/backup", exigirBanco, wrap(async (_req, res) => {
  await garantirBackupDoDia();
  const ultimo = await query(
    "SELECT payload, criado_em FROM copias_seguranca ORDER BY criado_em DESC LIMIT 1",
  );
  const pacote = ultimo.rows[0]?.payload ?? (await montarPacote());
  const dia = isoData(ultimo.rows[0]?.criado_em) || isoData(new Date());
  res.setHeader("Content-Disposition", `attachment; filename="galpao-backup-${dia}.json"`);
  res.json(pacote);
}));

app.get("/api/planilha", exigirBanco, wrap(async (_req, res) => {
  res.json({ entradas: await carregarEntradas() });
}));

app.put("/api/entradas/:id", exigirBanco, wrap(async (req, res) => {
  const { id } = req.params;
  const body = req.body ?? {};
  const destinos = Array.isArray(body.destinos) ? body.destinos : [];
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
        isoData(body.data),
        body.produtor ?? "",
        body.mercadoria ?? "",
        numero(body.qtd) ?? 0,
        numero(body.preco),
        numero(body.precoFraco),
        numero(body.rendimentoExtra),
      ],
    );
    await cliente.query("DELETE FROM destinos WHERE entrada_id = $1", [id]);
    for (const destino of destinos) {
      if (!destino?.id) continue;
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
  res.json({ ok: true, id });
}));

app.delete("/api/entradas/:id", exigirBanco, wrap(async (req, res) => {
  await query("DELETE FROM entradas WHERE id = $1", [req.params.id]);
  await tocarVersao();
  res.json({ ok: true });
}));

function rotasCadastro(caminho, tabela, mapRow, paraLinha) {
  app.get(`/api/${caminho}`, exigirBanco, wrap(async (_req, res) => {
    const resultado = await query(`SELECT * FROM ${tabela} ORDER BY nome`);
    res.json(resultado.rows.map(mapRow));
  }));

  app.put(`/api/${caminho}/:id`, exigirBanco, wrap(async (req, res) => {
    const { texto, valores } = paraLinha(req.params.id, req.body ?? {});
    await query(texto, valores);
    await tocarVersao();
    res.json({ ok: true, id: req.params.id });
  }));

  app.delete(`/api/${caminho}/:id`, exigirBanco, wrap(async (req, res) => {
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
  console.error(erro);
  res.status(500).json({ erro: String(erro.message || erro) });
});

const servidor = app.listen(porta, async () => {
  try {
    await garantirSchema();
    void garantirBackupDoDia();
    console.log(`API pronta em http://localhost:${porta} · banco ${bancoPronto() ? "ok" : "ausente"}`);
  } catch (erro) {
    console.error("Não foi possível preparar o banco:", erro);
  }
});

process.on("SIGTERM", () => servidor.close());
