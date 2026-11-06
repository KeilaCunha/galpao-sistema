const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const CHAVE_TOKEN = "galpao:sessao-token";

export const apiRemota = Boolean(base);

function lerTokenGuardado(): string {
  try {
    window.localStorage.removeItem(CHAVE_TOKEN);
    return window.sessionStorage.getItem(CHAVE_TOKEN) ?? "";
  } catch {
    return "";
  }
}

const liberacoes = new Map<string, string>();
let tokenMemoria = lerTokenGuardado();
let aoExpirar: (() => void) | null = null;

export class ErroApi extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function tokenAtual(): string {
  return tokenMemoria;
}

export function definirToken(token: string) {
  tokenMemoria = token;
  try {
    window.localStorage.removeItem(CHAVE_TOKEN);
    if (token) window.sessionStorage.setItem(CHAVE_TOKEN, token);
    else window.sessionStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* modo privado */
  }
}

export function aoSessaoExpirar(fn: (() => void) | null) {
  aoExpirar = fn;
}

export function guardarLiberacao(entradaId: string, token: string) {
  liberacoes.set(entradaId, token);
}

export function tokenLiberacao(entradaId: string): string | undefined {
  return liberacoes.get(entradaId);
}

export function consumirLiberacao(entradaId: string) {
  liberacoes.delete(entradaId);
}

function mensagemErro(texto: string, status: number): string {
  const limpo = (texto ?? "").trim();
  if (/<!DOCTYPE html>/i.test(limpo) || /<html[\s>]/i.test(limpo) || /Cannot (GET|POST|PUT|DELETE)/i.test(limpo)) {
    return "Ainda não dá para gravar pessoas neste computador. O cadastro no banco só funciona com o selo verde (Banco ao vivo). No site isso entra depois do SUBA.";
  }
  try {
    const json = JSON.parse(limpo) as { erro?: string };
    if (json.erro) return json.erro;
  } catch {
    /* texto puro */
  }
  if (limpo.length > 180) return `Não deu para salvar (${status}).`;
  return limpo || `Não deu para salvar (${status}).`;
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (tokenMemoria) headers.Authorization = `Bearer ${tokenMemoria}`;
  const resposta = await fetch(`${base}/api${caminho}`, { ...init, headers });
  if (resposta.status === 401 && !caminho.startsWith("/auth/") && caminho !== "/health") {
    definirToken("");
    aoExpirar?.();
  }
  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new ErroApi(resposta.status, mensagemErro(texto, resposta.status));
  }
  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}

export async function checarBanco(): Promise<boolean> {
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    try {
      const saude = await pedir<{ ok: boolean; db: boolean }>("/health", {
        signal: AbortSignal.timeout(20000),
      });
      return Boolean(saude.ok && saude.db);
    } catch {
      if (tentativa === 7) return false;
      await new Promise((resolver) => window.setTimeout(resolver, 2000));
    }
  }
  return false;
}

export const api = {
  get: <T>(caminho: string) => pedir<T>(caminho),
  post: <T>(caminho: string, body?: unknown) =>
    pedir<T>(caminho, { method: "POST", body: body == null ? undefined : JSON.stringify(body) }),
  put: <T>(caminho: string, body: unknown) =>
    pedir<T>(caminho, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(caminho: string) => pedir<T>(caminho, { method: "DELETE" }),
};

export async function baixarBackup(nome: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (tokenMemoria) headers.Authorization = `Bearer ${tokenMemoria}`;
  const resposta = await fetch(`${base}/api/backup`, { headers });
  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new ErroApi(resposta.status, mensagemErro(texto, resposta.status));
  }
  const blob = await resposta.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  link.click();
  URL.revokeObjectURL(link.href);
}
