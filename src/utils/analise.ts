import type { PedidoCliente, PrevisaoFornecedor } from "../types";
import { mesmaChave, pedidoPersistivel } from "./pedido";

export function previsaoPersistivel(previsao: PrevisaoFornecedor): boolean {
  return Boolean(previsao.mercadoria.trim() && previsao.qtd > 0);
}

export function previsaoExistente(
  lista: PrevisaoFornecedor[],
  data: string,
  mercadoria: string,
  fornecedor?: string,
): PrevisaoFornecedor | undefined {
  return lista.find(
    (item) =>
      item.data === data &&
      mesmaChave(item.mercadoria, mercadoria) &&
      mesmaChave(item.fornecedor ?? "", fornecedor ?? ""),
  );
}

export type ClientePedido = { nome: string; qtd: number };

export type LinhaAnalise = {
  mercadoria: string;
  pedido: number;
  vem: number;
  saldo: number;
  status: "sem-previsao" | "comprar" | "sobra" | "bate";
  clientes: ClientePedido[];
};

function semAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type TotalMercadoria = { mercadoria: string; qtd: number };

export function totaisBasePorMercadoria(previsoes: PrevisaoFornecedor[]): TotalMercadoria[] {
  const mapa = new Map<string, { nome: string; qtd: number }>();
  for (const item of previsoes) {
    if (!previsaoPersistivel(item)) continue;
    const chave = semAcento(item.mercadoria) || item.mercadoria;
    const atual = mapa.get(chave);
    if (atual) atual.qtd += item.qtd;
    else mapa.set(chave, { nome: item.mercadoria.trim(), qtd: item.qtd });
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function montarAnalise(
  pedidos: PedidoCliente[],
  previsoes: PrevisaoFornecedor[],
  data: string,
): LinhaAnalise[] {
  type Acc = { nome: string; pedido: number; vem: number; clientes: Map<string, ClientePedido> };
  const mapa = new Map<string, Acc>();

  const de = (nome: string) => {
    const chave = semAcento(nome) || nome;
    let atual = mapa.get(chave);
    if (!atual) {
      atual = { nome: nome.trim() || nome, pedido: 0, vem: 0, clientes: new Map() };
      mapa.set(chave, atual);
    }
    return atual;
  };

  for (const pedido of pedidos) {
    if (pedido.data !== data || !pedidoPersistivel(pedido)) continue;
    const item = de(pedido.mercadoria);
    item.pedido += pedido.qtd;
    const chaveCliente = semAcento(pedido.cliente) || pedido.cliente;
    const atual = item.clientes.get(chaveCliente);
    if (atual) atual.qtd += pedido.qtd;
    else item.clientes.set(chaveCliente, { nome: pedido.cliente.trim(), qtd: pedido.qtd });
  }

  for (const previsao of previsoes) {
    if (previsao.data !== data || !previsaoPersistivel(previsao)) continue;
    de(previsao.mercadoria).vem += previsao.qtd;
  }

  const ordem = { comprar: 0, "sem-previsao": 1, sobra: 2, bate: 3 } as const;

  return [...mapa.values()]
    .filter((item) => item.pedido > 0 || item.vem > 0)
    .map((item) => {
      const saldo = item.vem - item.pedido;
      let status: LinhaAnalise["status"];
      if (item.vem <= 0 && item.pedido > 0) status = "sem-previsao";
      else if (saldo < 0) status = "comprar";
      else if (saldo > 0) status = "sobra";
      else status = "bate";
      return {
        mercadoria: item.nome,
        pedido: item.pedido,
        vem: item.vem,
        saldo,
        status,
        clientes: [...item.clientes.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      };
    })
    .sort(
      (a, b) =>
        ordem[a.status] - ordem[b.status] || a.mercadoria.localeCompare(b.mercadoria, "pt-BR"),
    );
}
