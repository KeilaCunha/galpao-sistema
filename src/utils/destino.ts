import type { DestinoEntrada, LinhaPlanilha } from "../types";
import { destinoEhSobra, qtdDestino } from "./classificacao";
import { addDays } from "./format";

/** Só conta como lançado quando tem quantidade ou motivo — cliente sozinho é rascunho. */
export function destinoPersistivel(destino: DestinoEntrada): boolean {
  if (destino.motivo?.trim()) return true;
  return destinoTemQuantidade(destino);
}

/** Destino com caixa de verdade, o que aparece na folha. */
export function destinoTemQuantidade(destino: DestinoEntrada): boolean {
  return (qtdDestino(destino) ?? 0) > 0;
}

export interface ResumoDestino {
  /** Soma das quantidades "boa" de todos os destinos */
  boa: number;
  /** Soma das quantidades "fraca" de todos os destinos */
  fraca: number;
  /** Soma das perdas alocadas */
  perda: number;
  /** Total geral (boa + fraca + perda) */
  total: number;
}

/**
 * Soma automaticamente as quantidades boa/fraca de todos os destinos (clientes)
 * informados para uma linha da planilha. Essa soma alimenta a coluna "Qtd. feita".
 */
export function resumoDestinos(destinos: DestinoEntrada[]): ResumoDestino {
  let boa = 0;
  let fraca = 0;
  let perda = 0;

  for (const destino of destinos) {
    boa += destino.boa ?? 0;
    fraca += destino.fraca ?? 0;
    perda += destino.perda ?? 0;
  }

  return { boa, fraca, perda, total: boa + fraca + perda };
}

/**
 * Qtd feita da linha: vendas destinadas + caixas lançadas como sobra para o outro dia.
 * A sobra conta mesmo quando a carga rendeu além da quantidade informada.
 */
export function resumoAlocado(destinos: DestinoEntrada[], _qtd: number | null): ResumoDestino {
  const vendas: DestinoEntrada[] = [];
  const reservas: DestinoEntrada[] = [];
  for (const destino of destinos) {
    if (destinoEhSobra(destino)) reservas.push(destino);
    else vendas.push(destino);
  }
  const venda = resumoDestinos(vendas);
  const reserva = resumoDestinos(reservas);
  return {
    boa: venda.boa + reserva.boa,
    fraca: venda.fraca + reserva.fraca,
    perda: venda.perda,
    total: venda.total + reserva.total,
  };
}

/**
 * Soma o resumo (boa/fraca) de uma linha **incluindo o que foi resolvido nos dias seguintes**,
 * seguindo a cadeia de sobras (linha -> sobra do dia seguinte -> sobra do dia seguinte...).
 *
 * Isso faz com que, se no dia 21 o funcionário vender toda a sobra que ficou do dia 20,
 * a linha original do dia 20 passe a aparecer como "Completo" automaticamente — o que foi
 * feito depois é descontado/abatido na linha de origem, sem precisar editar nada no dia 20.
 */
export function resumoComCadeia(
  getLinhas: (data: string) => LinhaPlanilha[],
  data: string,
  linha: LinhaPlanilha,
): ResumoDestino {
  let boa = 0;
  let fraca = 0;
  let perda = 0;

  let linhaAtual: LinhaPlanilha = linha;
  let dataAtual = data;
  const visitados = new Set<string>();

  while (!visitados.has(linhaAtual.id)) {
    visitados.add(linhaAtual.id);

    const proprio = resumoDestinos(linhaAtual.destinos);
    boa += proprio.boa;
    fraca += proprio.fraca;
    perda += proprio.perda;

    const proximaData = addDays(dataAtual, 1);
    const continuacao = getLinhas(proximaData).find((l) => l.origemLinhaId === linhaAtual.id);
    if (!continuacao) break;

    linhaAtual = continuacao;
    dataAtual = proximaData;
  }

  return { boa, fraca, perda, total: boa + fraca + perda };
}

/**
 * Encontra a "ponta" da cadeia de sobras de uma linha: a linha (e o dia) mais recente
 * ainda em aberto, seguindo sobra -> sobra do dia seguinte -> sobra do dia seguinte...
 * É nesta linha que o funcionário deve informar o destino para resolver a sobra.
 */
export function pontaDaCadeia(
  getLinhas: (data: string) => LinhaPlanilha[],
  data: string,
  linha: LinhaPlanilha,
): { data: string; linha: LinhaPlanilha } {
  let linhaAtual = linha;
  let dataAtual = data;
  const visitados = new Set<string>();

  while (!visitados.has(linhaAtual.id)) {
    visitados.add(linhaAtual.id);
    const proximaData = addDays(dataAtual, 1);
    const continuacao = getLinhas(proximaData).find((l) => l.origemLinhaId === linhaAtual.id);
    if (!continuacao) break;
    linhaAtual = continuacao;
    dataAtual = proximaData;
  }

  return { data: dataAtual, linha: linhaAtual };
}

/** Verifica se um destino possui alguma informação preenchida pelo funcionário */
export function destinoPossuiDados(destino: DestinoEntrada): boolean {
  return Boolean(destino.cliente.trim() || destino.boa !== null || destino.fraca !== null);
}

export type StatusQtdFeita = "vazio" | "sem-meta" | "parcial" | "completo" | "excedente";

/**
 * Classifica a situação da "Qtd. feita" de uma linha, comparando a soma dos
 * destinos com a quantidade (Qtd.) informada:
 * - "vazio": nenhum destino preenchido ainda.
 * - "sem-meta": há destinos, mas a Qtd. não foi informada (não dá para saber se sobrou algo).
 * - "parcial": a soma dos destinos é menor que a Qtd. — sobrou quantidade para distribuir.
 * - "completo": a soma dos destinos bate exatamente com a Qtd.
 * - "excedente": a soma dos destinos é maior que a Qtd. informada (possível erro de digitação).
 */
export function statusQtdFeita(qtd: number | null, resumo: ResumoDestino): StatusQtdFeita {
  if (resumo.total === 0) return "vazio";
  if (qtd === null) return "sem-meta";
  if (resumo.total === qtd) return "completo";
  if (resumo.total > qtd) return "excedente";
  return "parcial";
}

/** Calcula a quantidade que ainda falta distribuir (sobra) em relação à Qtd. informada */
export function calcularSobra(qtd: number | null, resumo: ResumoDestino): number {
  if (qtd === null) return 0;
  const diferenca = qtd - resumo.total;
  return diferenca > 0 ? diferenca : 0;
}

/** Caixas a mais só do que foi destinado (boa + fraca). Perda não entra no rendimento. */
export function calcularRendimento(qtd: number | null, resumo: ResumoDestino): number {
  if (qtd === null) return 0;
  const destinado = resumo.boa + resumo.fraca;
  return destinado > qtd ? destinado - qtd : 0;
}

export function temAjusteFeita(linha: { feitaBoa?: number | null; feitaFraca?: number | null }): boolean {
  return linha.feitaBoa != null || linha.feitaFraca != null;
}

/** Qtd feita na tela: destinos, mais o que o administrador digitou. */
export function resumoQtdFeita(linha: {
  destinos: DestinoEntrada[];
  qtd: number | null;
  feitaBoa?: number | null;
  feitaFraca?: number | null;
  rendimentoExtra?: number;
}): ResumoDestino {
  const base = resumoAlocado(linha.destinos, linha.qtd);
  const extra = linha.rendimentoExtra ?? 0;
  const boa = linha.feitaBoa ?? base.boa + (temAjusteFeita(linha) ? 0 : extra);
  const fraca = linha.feitaFraca ?? base.fraca;
  return { boa, fraca, perda: base.perda, total: boa + fraca + base.perda };
}

/** Extra que rendeu além da qtd e além do que já está nos destinos. Não mexe na qtd recebida. */
export function extraDeFeita(
  qtd: number | null,
  destinos: DestinoEntrada[],
  boa: number | null,
  fraca: number | null,
): number {
  const base = resumoAlocado(destinos, qtd);
  const feitoBoa = boa ?? base.boa;
  const feitoFraca = fraca ?? base.fraca;
  const feito = feitoBoa + feitoFraca;
  const teto = Math.max(qtd ?? 0, base.boa + base.fraca);
  return Math.max(0, feito - teto);
}
