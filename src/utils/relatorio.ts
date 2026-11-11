import type { EntradaLancamento } from "../types";
import { dataDoDestino, destinosDa, entradaValida } from "./alocacao";
import { qtdDestino, tipoEhEstoque, tipoEhFraco, tipoEhPerda } from "./classificacao";
import { datasNoIntervalo } from "./periodo";

export interface DiaOperacao {
  data: string;
  recebido: number;
  feitoBom: number;
  feitoFraco: number;
  perda: number;
}

export interface ClientePeriodo {
  cliente: string;
  mercadoria: string;
  boa: number;
  fraca: number;
  total: number;
}

export interface ObservacaoRelatorio {
  data: string;
  produtor: string;
  mercadoria: string;
  texto: string;
}

export interface RelatorioOperacao {
  de: string;
  ate: string;
  recebido: number;
  feitoBom: number;
  feitoFraco: number;
  perda: number;
  dias: DiaOperacao[];
  clientes: ClientePeriodo[];
  observacoes: ObservacaoRelatorio[];
}

export interface LinhaFornecedor {
  data: string;
  mercadoria: string;
  veio: number;
  boa: number;
  fraca: number;
  perda: number;
  preco: number | null;
  precoFraco: number | null;
  valor: number;
  observacao?: string;
}

export function valorPagarFornecedor(
  boa: number,
  fraca: number,
  precoBom: number | null | undefined,
  precoFraco: number | null | undefined,
): number {
  return boa * (precoBom ?? 0) + fraca * (precoFraco ?? 0);
}

export interface GrupoFornecedor {
  produtor: string;
  linhas: LinhaFornecedor[];
  veio: number;
  boa: number;
  fraca: number;
  perda: number;
  valor: number;
}

export interface RelatorioFornecedor {
  de: string;
  ate: string;
  grupos: GrupoFornecedor[];
  veio: number;
  valor: number;
}

function diaIso(valor: string): string {
  return (valor || "").split("T")[0] ?? "";
}

function noPeriodo(data: string, de: string, ate: string): boolean {
  const dia = diaIso(data);
  return dia >= diaIso(de) && dia <= diaIso(ate);
}

function resultadoCarga(entrada: EntradaLancamento) {
  let boa = 0;
  let fraca = 0;
  let perda = 0;
  for (const destino of destinosDa(entrada)) {
    if (tipoEhEstoque(destino.tipo)) continue;
    perda += destino.perda ?? 0;
    if (tipoEhPerda(destino.tipo)) continue;
    const qtd = qtdDestino(destino) ?? 0;
    if (tipoEhFraco(destino.tipo)) fraca += qtd;
    else boa += qtd;
  }
  return { boa, fraca, perda };
}

export function montarRelatorioOperacao(
  entradas: EntradaLancamento[],
  de: string,
  ate: string,
): RelatorioOperacao {
  const inicio = diaIso(de);
  const fim = diaIso(ate);
  const porDia = new Map<string, DiaOperacao>();
  for (const data of datasNoIntervalo(inicio, fim)) {
    porDia.set(data, { data, recebido: 0, feitoBom: 0, feitoFraco: 0, perda: 0 });
  }

  function diaDoRelatorio(data: string): DiaOperacao | undefined {
    const chave = diaIso(data);
    let dia = porDia.get(chave);
    if (!dia && noPeriodo(chave, inicio, fim)) {
      dia = { data: chave, recebido: 0, feitoBom: 0, feitoFraco: 0, perda: 0 };
      porDia.set(chave, dia);
    }
    return dia;
  }

  const porCliente = new Map<string, ClientePeriodo>();
  const observacoes: ObservacaoRelatorio[] = [];

  for (const entrada of entradas.filter(entradaValida)) {
    if (noPeriodo(entrada.data, inicio, fim)) {
      const dia = diaDoRelatorio(entrada.data);
      if (dia) dia.recebido += entrada.qtd;
      const texto = entrada.observacao?.trim();
      if (texto) {
        observacoes.push({
          data: entrada.data,
          produtor: entrada.produtor.trim() || "Sem fornecedor",
          mercadoria: entrada.mercadoria.trim() || "Mercadoria",
          texto,
        });
      }
    }

    for (const destino of destinosDa(entrada)) {
      const dataDestino = dataDoDestino(destino, entrada);
      if (!noPeriodo(dataDestino, inicio, fim)) continue;
      const dia = diaDoRelatorio(dataDestino);
      if (!dia) continue;
      if (tipoEhEstoque(destino.tipo)) continue;

      dia.perda += destino.perda ?? 0;
      if (tipoEhPerda(destino.tipo)) continue;
      dia.feitoBom += destino.boa ?? 0;
      dia.feitoFraco += destino.fraca ?? 0;

      const cliente = destino.cliente.trim();
      if (!cliente) continue;
      const mercadoria = entrada.mercadoria || "Mercadoria";
      const chave = `${cliente.toLowerCase()}|${mercadoria.toLowerCase()}`;
      const item = porCliente.get(chave) ?? { cliente, mercadoria, boa: 0, fraca: 0, total: 0 };
      item.boa += destino.boa ?? 0;
      item.fraca += destino.fraca ?? 0;
      item.total = item.boa + item.fraca;
      porCliente.set(chave, item);
    }
  }

  const dias = [...porDia.values()].filter(
    (dia) => dia.recebido > 0 || dia.feitoBom > 0 || dia.feitoFraco > 0 || dia.perda > 0,
  );
  const clientes = [...porCliente.values()]
    .filter((item) => item.total > 0)
    .sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR") || a.mercadoria.localeCompare(b.mercadoria, "pt-BR"));

  return {
    de,
    ate,
    recebido: dias.reduce((s, d) => s + d.recebido, 0),
    feitoBom: dias.reduce((s, d) => s + d.feitoBom, 0),
    feitoFraco: dias.reduce((s, d) => s + d.feitoFraco, 0),
    perda: dias.reduce((s, d) => s + d.perda, 0),
    dias,
    clientes,
    observacoes,
  };
}

export function montarRelatorioFornecedor(
  entradas: EntradaLancamento[],
  de: string,
  ate: string,
): RelatorioFornecedor {
  const grupos = new Map<string, GrupoFornecedor>();

  for (const entrada of entradas.filter(entradaValida)) {
    if (!noPeriodo(entrada.data, diaIso(de), diaIso(ate))) continue;
    const produtor = entrada.produtor.trim() || "Sem fornecedor";
    const resultado = resultadoCarga(entrada);
    const preco = entrada.preco;
    const precoFraco = entrada.precoFraco ?? null;
    const linha: LinhaFornecedor = {
      data: entrada.data,
      mercadoria: entrada.mercadoria,
      veio: entrada.qtd,
      boa: resultado.boa,
      fraca: resultado.fraca,
      perda: resultado.perda,
      preco,
      precoFraco,
      valor: valorPagarFornecedor(resultado.boa, resultado.fraca, preco, precoFraco),
      observacao: entrada.observacao?.trim() || undefined,
    };
    const grupo = grupos.get(produtor) ?? {
      produtor,
      linhas: [],
      veio: 0,
      boa: 0,
      fraca: 0,
      perda: 0,
      valor: 0,
    };
    grupo.linhas.push(linha);
    grupo.veio += linha.veio;
    grupo.boa += linha.boa;
    grupo.fraca += linha.fraca;
    grupo.perda += linha.perda;
    grupo.valor += linha.valor;
    grupos.set(produtor, grupo);
  }

  const lista = [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      linhas: [...grupo.linhas].sort((a, b) => a.data.localeCompare(b.data) || a.mercadoria.localeCompare(b.mercadoria, "pt-BR")),
    }))
    .sort((a, b) => a.produtor.localeCompare(b.produtor, "pt-BR"));

  return {
    de,
    ate,
    grupos: lista,
    veio: lista.reduce((s, g) => s + g.veio, 0),
    valor: lista.reduce((s, g) => s + g.valor, 0),
  };
}
