CREATE TABLE IF NOT EXISTS fornecedores (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  documento TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  classificacao_id TEXT,
  unidade TEXT NOT NULL DEFAULT 'caixa',
  estoque_atual NUMERIC NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT NOT NULL DEFAULT '',
  situacao TEXT NOT NULL DEFAULT 'ativo',
  tipos TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  documento TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entradas (
  id TEXT PRIMARY KEY,
  data DATE NOT NULL,
  produtor TEXT NOT NULL DEFAULT '',
  mercadoria TEXT NOT NULL DEFAULT '',
  qtd NUMERIC NOT NULL DEFAULT 0,
  preco NUMERIC,
  preco_fraco NUMERIC,
  rendimento_extra NUMERIC,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS destinos (
  id TEXT PRIMARY KEY,
  entrada_id TEXT NOT NULL REFERENCES entradas(id) ON DELETE CASCADE,
  cliente TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  data DATE,
  origem TEXT NOT NULL DEFAULT 'folha',
  boa NUMERIC,
  fraca NUMERIC,
  perda NUMERIC,
  motivo TEXT,
  saida_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_entradas_data ON entradas(data);
CREATE INDEX IF NOT EXISTS idx_destinos_entrada ON destinos(entrada_id);

CREATE TABLE IF NOT EXISTS sync_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  versao BIGINT NOT NULL DEFAULT 0
);
INSERT INTO sync_meta (id, versao) VALUES (1, 0) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS copias_seguranca (
  id TEXT PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_copias_criado ON copias_seguranca (criado_em DESC);
