import type { EntradaLancamento, MovimentoCaixa, TipoCaixa } from "../types";
import { datasNoIntervalo } from "./periodo";

function semAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function mesmaPessoa(a: string, b: string): boolean {
  return semAcento(a) === semAcento(b);
}

export function mesmoTipoCaixa(a: string, b: string): boolean {
  return semAcento(a) === semAcento(b);
}

export const TIPO_CAIXA_PADRAO = "Plástica";

export function tipoCaixaDaEntrada(entrada: { tipoCaixa?: string }): string {
  const nome = entrada.tipoCaixa?.trim();
  return nome || TIPO_CAIXA_PADRAO;
}

export function ehTipoCaixaPadrao(nome: string): boolean {
  return mesmoTipoCaixa(nome.trim() || TIPO_CAIXA_PADRAO, TIPO_CAIXA_PADRAO);
}

function entradaContaNoTipo(entrada: EntradaLancamento, tipo?: string): boolean {
  if (!tipo?.trim()) return true;
  return mesmoTipoCaixa(tipoCaixaDaEntrada(entrada), tipo);
}

export function nomesTipoCaixa(tipos: TipoCaixa[]): string[] {
  const nomes = tipos.map((tipo) => tipo.nome.trim()).filter(Boolean);
  const temPadrao = nomes.some((nome) => ehTipoCaixaPadrao(nome));
  const outros = nomes.filter((nome) => !ehTipoCaixaPadrao(nome));
  const padrao = nomes.find((nome) => ehTipoCaixaPadrao(nome)) ?? TIPO_CAIXA_PADRAO;
  return temPadrao ? [padrao, ...outros] : [TIPO_CAIXA_PADRAO, ...outros];
}

export function caixaPersistivel(movimento: MovimentoCaixa): boolean {
  return Boolean(movimento.fornecedor.trim() && (movimento.tipo ?? "").trim() && (movimento.pegou ?? 0) > 0);
}

export function tipoCaixaPersistivel(tipo: TipoCaixa): boolean {
  return Boolean(tipo.nome.trim());
}

export function movimentoDoDia(
  movimentos: MovimentoCaixa[],
  data: string,
  fornecedor: string,
  tipo: string,
): MovimentoCaixa | undefined {
  return movimentos.find(
    (item) =>
      item.data === data &&
      mesmaPessoa(item.fornecedor, fornecedor) &&
      mesmoTipoCaixa(item.tipo ?? "", tipo),
  );
}

/** Caixas que chegaram com a carga: soma da qtd lançada na folha naquele dia. */
export function veioNaFolha(
  entradas: EntradaLancamento[],
  data: string,
  fornecedor: string,
  tipo?: string,
): number {
  return entradas.reduce((soma, entrada) => {
    if (entrada.data !== data) return soma;
    if (!mesmaPessoa(entrada.produtor, fornecedor)) return soma;
    if (!entradaContaNoTipo(entrada, tipo)) return soma;
    return soma + (entrada.qtd || 0);
  }, 0);
}

export function veioNaFolhaAte(
  entradas: EntradaLancamento[],
  fornecedor: string,
  ate: string,
  tipo?: string,
): number {
  return entradas.reduce((soma, entrada) => {
    if (entrada.data > ate) return soma;
    if (!mesmaPessoa(entrada.produtor, fornecedor)) return soma;
    if (!entradaContaNoTipo(entrada, tipo)) return soma;
    return soma + (entrada.qtd || 0);
  }, 0);
}

export function pegouAte(
  movimentos: MovimentoCaixa[],
  fornecedor: string,
  ate: string,
  tipo?: string,
): number {
  return movimentos.reduce((soma, item) => {
    if (item.data > ate) return soma;
    if (!mesmaPessoa(item.fornecedor, fornecedor)) return soma;
    if (tipo && !mesmoTipoCaixa(item.tipo ?? "", tipo)) return soma;
    return soma + (item.pegou || 0);
  }, 0);
}

/**
 * Estoque com o fornecedor até a data: o que ele pegou menos o que veio na folha.
 * Ex.: tinha 300, veio 200 tomate, pegou 100 → fica com 200.
 */
export function saldoCaixas(
  movimentos: MovimentoCaixa[],
  entradas: EntradaLancamento[],
  fornecedor: string,
  ate: string,
  tipo?: string,
): number {
  return pegouAte(movimentos, fornecedor, ate, tipo) - veioNaFolhaAte(entradas, fornecedor, ate, tipo);
}

export function resumoCaixasDia(movimentos: MovimentoCaixa[], entradas: EntradaLancamento[], data: string) {
  let veio = 0;
  let pegou = 0;
  const nomes = new Set<string>();
  for (const entrada of entradas) {
    if (entrada.data !== data) continue;
    veio += entrada.qtd || 0;
    if (entrada.produtor.trim()) nomes.add(semAcento(entrada.produtor));
  }
  for (const item of movimentos) {
    if (item.data !== data) continue;
    pegou += item.pegou || 0;
    if (item.fornecedor.trim()) nomes.add(semAcento(item.fornecedor));
  }
  return { veio, pegou, lancados: nomes.size };
}

export function totalComFornecedores(
  movimentos: MovimentoCaixa[],
  entradas: EntradaLancamento[],
  ate: string,
  nomes: string[],
): number {
  return nomes.reduce((soma, nome) => {
    const valor = saldoCaixas(movimentos, entradas, nome, ate);
    return soma + (valor > 0 ? valor : 0);
  }, 0);
}

export function veioNaFolhaPeriodo(
  entradas: EntradaLancamento[],
  fornecedor: string,
  de: string,
  ate: string,
  tipo?: string,
): number {
  return entradas.reduce((soma, entrada) => {
    if (entrada.data < de || entrada.data > ate) return soma;
    if (!mesmaPessoa(entrada.produtor, fornecedor)) return soma;
    if (!entradaContaNoTipo(entrada, tipo)) return soma;
    return soma + (entrada.qtd || 0);
  }, 0);
}

export function pegouPeriodo(
  movimentos: MovimentoCaixa[],
  fornecedor: string,
  de: string,
  ate: string,
  tipo?: string,
): number {
  return movimentos.reduce((soma, item) => {
    if (item.data < de || item.data > ate) return soma;
    if (!mesmaPessoa(item.fornecedor, fornecedor)) return soma;
    if (tipo && !mesmoTipoCaixa(item.tipo ?? "", tipo)) return soma;
    return soma + (item.pegou || 0);
  }, 0);
}

export interface RelatorioCaixasMovimento {
  data: string;
  fornecedor: string;
  veio: number;
  pegou: number;
  detalhe: { tipo: string; pegou: number }[];
}

export interface RelatorioCaixasFornecedor {
  nome: string;
  veio: number;
  pegou: number;
  estoque: number;
}

export interface RelatorioCaixas {
  de: string;
  ate: string;
  tipo: string;
  veio: number;
  pegou: number;
  estoque: number;
  movimentos: RelatorioCaixasMovimento[];
  fornecedores: RelatorioCaixasFornecedor[];
}

export function montarRelatorioCaixas(
  movimentos: MovimentoCaixa[],
  entradas: EntradaLancamento[],
  de: string,
  ate: string,
  tipo: string,
  nomes: string[],
): RelatorioCaixas {
  const filtroTipo = tipo.trim();
  const tipoFiltro = filtroTipo || undefined;
  const dias = datasNoIntervalo(de, ate);
  const lista: RelatorioCaixasMovimento[] = [];

  for (const data of dias) {
    for (const nome of nomes) {
      const veio = veioNaFolha(entradas, data, nome, tipoFiltro);
      const detalhe = movimentos
        .filter(
          (item) =>
            item.data === data &&
            mesmaPessoa(item.fornecedor, nome) &&
            (item.pegou || 0) > 0 &&
            (!filtroTipo || mesmoTipoCaixa(item.tipo ?? "", filtroTipo)),
        )
        .map((item) => ({ tipo: item.tipo, pegou: item.pegou || 0 }));
      const pegou = detalhe.reduce((soma, item) => soma + item.pegou, 0);
      if (veio <= 0 && pegou <= 0) continue;
      lista.push({ data, fornecedor: nome, veio, pegou, detalhe });
    }
  }

  const porFornecedor: RelatorioCaixasFornecedor[] = nomes
    .map((nome) => ({
      nome,
      veio: veioNaFolhaPeriodo(entradas, nome, de, ate, tipoFiltro),
      pegou: pegouPeriodo(movimentos, nome, de, ate, tipoFiltro),
      estoque: saldoCaixas(movimentos, entradas, nome, ate, tipoFiltro),
    }))
    .filter((item) => item.veio > 0 || item.pegou > 0 || item.estoque !== 0);

  return {
    de,
    ate,
    tipo: filtroTipo,
    veio: porFornecedor.reduce((soma, item) => soma + item.veio, 0),
    pegou: porFornecedor.reduce((soma, item) => soma + item.pegou, 0),
    estoque: totalComFornecedores(movimentos, entradas, ate, nomes),
    movimentos: lista,
    fornecedores: porFornecedor,
  };
}
