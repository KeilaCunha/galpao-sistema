import type { EntradaLancamento, PedidoCliente } from "../types";
import { destinosDoDia } from "./alocacao";
import {
  abrevTipo,
  nomeTipoCliente,
  ordemClassificacao,
  qtdDestino,
  tipoEhEstoque,
  tipoEhFraco,
  tipoEhPerda,
} from "./classificacao";

export type ChipCliente = {
  chave: string;
  label: string;
  qtd: number;
  fraco: boolean;
  pedidoIds?: string[];
};

export type LinhaPorCliente = {
  mercadoria: string;
  feito: ChipCliente[];
  pedido: ChipCliente[];
  totalFeito: number;
  totalPedido: number;
  status: "sem-pedido" | "bate" | "falta" | "passou";
  diferenca: number;
};

export type GrupoPorCliente = {
  cliente: string;
  itens: LinhaPorCliente[];
  totalFeito: number;
  totalPedido: number;
};

function semAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function pedidoPersistivel(pedido: PedidoCliente): boolean {
  return Boolean(pedido.cliente.trim() && pedido.mercadoria.trim() && pedido.qtd > 0);
}

export function mesmaChave(a: string, b: string): boolean {
  return semAcento(a) === semAcento(b);
}

function chipDeTipo(tipo: string, qtd: number): ChipCliente | null {
  if (qtd <= 0) return null;
  const fraco = tipoEhFraco(tipo);
  const chave = fraco ? "fraco" : abrevTipo(tipo) || "boa";
  return { chave, label: nomeTipoCliente(tipo, fraco), qtd, fraco };
}

function somarChip(mapa: Map<string, ChipCliente>, chip: ChipCliente, pedidoId?: string) {
  const atual = mapa.get(chip.chave);
  const ids = pedidoId ? [pedidoId] : [];
  if (atual) {
    atual.qtd += chip.qtd;
    if (ids.length) atual.pedidoIds = [...(atual.pedidoIds ?? []), ...ids];
  } else {
    mapa.set(chip.chave, { ...chip, pedidoIds: ids.length ? ids : undefined });
  }
}

function ordenarChips(mercadoria: string, chips: ChipCliente[]): ChipCliente[] {
  return chips
    .filter((chip) => chip.qtd > 0)
    .sort((a, b) => ordemClassificacao(mercadoria, a.chave) - ordemClassificacao(mercadoria, b.chave));
}

function statusLinha(feito: ChipCliente[], pedido: ChipCliente[]): Pick<LinhaPorCliente, "status" | "diferenca"> {
  const totalFeito = feito.reduce((soma, chip) => soma + chip.qtd, 0);
  const totalPedido = pedido.reduce((soma, chip) => soma + chip.qtd, 0);
  if (totalPedido <= 0) return { status: "sem-pedido", diferenca: 0 };
  const porChave = new Map(pedido.map((chip) => [chip.chave, chip.qtd]));
  let bateTipo = true;
  for (const chip of feito) {
    if ((porChave.get(chip.chave) ?? 0) !== chip.qtd) bateTipo = false;
    porChave.delete(chip.chave);
  }
  if (porChave.size > 0) bateTipo = false;
  if (bateTipo && totalFeito === totalPedido) return { status: "bate", diferenca: 0 };
  if (totalFeito < totalPedido) return { status: "falta", diferenca: totalPedido - totalFeito };
  return { status: "passou", diferenca: totalFeito - totalPedido };
}

export function montarPorCliente(
  entradas: EntradaLancamento[],
  pedidos: PedidoCliente[],
  data: string,
): GrupoPorCliente[] {
  type Item = { mercadoria: string; feito: Map<string, ChipCliente>; pedido: Map<string, ChipCliente> };
  const clientes = new Map<string, { nome: string; ordem: number; itens: Map<string, Item> }>();
  let ordem = 0;

  const grupoDe = (nome: string) => {
    const chave = semAcento(nome) || nome;
    const atual = clientes.get(chave);
    if (atual) return atual;
    const novo = { nome: nome.trim() || nome, ordem: ordem++, itens: new Map<string, Item>() };
    clientes.set(chave, novo);
    return novo;
  };

  const itemDe = (grupo: { itens: Map<string, Item> }, mercadoria: string) => {
    const chave = semAcento(mercadoria) || mercadoria;
    const atual = grupo.itens.get(chave);
    if (atual) return atual;
    const novo: Item = { mercadoria, feito: new Map(), pedido: new Map() };
    grupo.itens.set(chave, novo);
    return novo;
  };

  for (const entrada of entradas) {
    const mercadoria = entrada.mercadoria || "Mercadoria";
    for (const destino of destinosDoDia(entrada, data)) {
      const cliente = destino.cliente.trim();
      if (!cliente || tipoEhPerda(destino.tipo) || tipoEhEstoque(destino.tipo)) continue;
      const tipo = destino.tipo?.trim() ?? "";
      const soFraca = !tipo && (destino.fraca ?? 0) > 0 && !(destino.boa ?? 0);
      const osDois = !tipo && (destino.boa ?? 0) > 0 && (destino.fraca ?? 0) > 0;
      const grupo = grupoDe(cliente);
      const item = itemDe(grupo, mercadoria);
      if (osDois) {
        const boa = chipDeTipo("BOM", destino.boa ?? 0);
        const fraca = chipDeTipo("FRACO", destino.fraca ?? 0);
        if (boa) somarChip(item.feito, boa);
        if (fraca) somarChip(item.feito, fraca);
      } else {
        const chip = chipDeTipo(tipoEhFraco(tipo) || soFraca ? "FRACO" : tipo, qtdDestino(destino) ?? 0);
        if (chip) somarChip(item.feito, chip);
      }
    }
  }

  for (const pedido of pedidos) {
    if (pedido.data !== data || !pedidoPersistivel(pedido)) continue;
    const grupo = grupoDe(pedido.cliente);
    const item = itemDe(grupo, pedido.mercadoria);
    const chip = chipDeTipo(pedido.tipo || "BOM", pedido.qtd);
    if (chip) somarChip(item.pedido, chip, pedido.id);
  }

  return [...clientes.values()]
    .sort((a, b) => a.ordem - b.ordem)
    .map((grupo) => {
      const itens = [...grupo.itens.values()]
        .map((item) => {
          const feito = ordenarChips(item.mercadoria, [...item.feito.values()]);
          const pedido = ordenarChips(item.mercadoria, [...item.pedido.values()]);
          const totalFeito = feito.reduce((soma, chip) => soma + chip.qtd, 0);
          const totalPedido = pedido.reduce((soma, chip) => soma + chip.qtd, 0);
          const { status, diferenca } = statusLinha(feito, pedido);
          return {
            mercadoria: item.mercadoria,
            feito,
            pedido,
            totalFeito,
            totalPedido,
            status,
            diferenca,
          };
        })
        .filter((item) => item.totalFeito > 0 || item.totalPedido > 0);
      return {
        cliente: grupo.nome,
        itens,
        totalFeito: itens.reduce((soma, item) => soma + item.totalFeito, 0),
        totalPedido: itens.reduce((soma, item) => soma + item.totalPedido, 0),
      };
    })
    .filter((grupo) => grupo.itens.length > 0);
}

export function pedidoExistente(
  lista: PedidoCliente[],
  data: string,
  cliente: string,
  mercadoria: string,
  tipo: string,
): PedidoCliente | undefined {
  return lista.find(
    (pedido) =>
      pedido.data === data &&
      mesmaChave(pedido.cliente, cliente) &&
      mesmaChave(pedido.mercadoria, mercadoria) &&
      mesmaChave(pedido.tipo || "BOM", tipo || "BOM"),
  );
}
