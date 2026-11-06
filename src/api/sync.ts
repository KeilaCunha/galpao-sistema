import type { Cliente, EntradaLancamento, Fornecedor, PedidoCliente, Produto } from "../types";
import { api } from "./http";

export type PacoteSync = {
  versao: number;
  entradas: EntradaLancamento[];
  fornecedores: Fornecedor[];
  produtos: Produto[];
  clientes: Cliente[];
  pedidos?: PedidoCliente[];
};

type Ouvinte = (pacote: PacoteSync) => void;

const ouvintes = new Set<Ouvinte>();
const pendentes = new Set<string>();
let timer: number | null = null;
let versaoLocal = -1;
let ligado = false;

export function marcarPendente(id: string) {
  pendentes.add(id);
}

export function limparPendente(id: string) {
  pendentes.delete(id);
}

export function idsPendentes(): Set<string> {
  return new Set(pendentes);
}

async function tick() {
  if (!ligado || pendentes.size > 0) return;
  try {
    const meta = await api.get<{ versao: number }>("/versao");
    if (meta.versao === versaoLocal) return;
    const pacote = await api.get<PacoteSync>("/sync");
    versaoLocal = pacote.versao;
    for (const ouvinte of ouvintes) ouvinte(pacote);
  } catch {
    /* o próximo ciclo tenta de novo */
  }
}

export function registrarVersao(versao: number) {
  versaoLocal = versao;
}

export function ouvirSync(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  if (timer == null) {
    ligado = true;
    void tick();
    timer = window.setInterval(() => void tick(), 2000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void tick();
    });
  }
  return () => {
    ouvintes.delete(ouvinte);
  };
}
