import type { DestinoEntrada, EntradaLancamento, LinhaPlanilha, SaidaLancamento } from "../types";
import { abrevMercadoria, mercadoriasIguais } from "./abrev";
import { destinoEhSobra, ehTomate, qtdDestino } from "./classificacao";

export function capacidadeEntrada(entrada: EntradaLancamento): number {
  return entrada.qtd;
}

export function entradaValida(entrada: EntradaLancamento): boolean {
  return Boolean(entrada.mercadoria.trim()) && capacidadeEntrada(entrada) > 0;
}

export function saidaValida(saida: SaidaLancamento): boolean {
  return Boolean(saida.mercadoria.trim()) && volumeSaida(saida) > 0;
}

export function volumeSaida(saida: SaidaLancamento): number {
  if (saida.tipo === "perda") return Math.max(0, saida.boa);
  return Math.max(0, (saida.boa || 0) + (saida.fraca || 0));
}

function ratear(lotes: { id: string; disponivel: number }[], qtd: number): { id: string; qtd: number }[] {
  const total = lotes.reduce((soma, lote) => soma + lote.disponivel, 0);
  if (total <= 0 || qtd <= 0) return [];
  const take = Math.min(qtd, total);
  const raw = lotes.map((lote) => {
    const exact = (take * lote.disponivel) / total;
    return { id: lote.id, qtd: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let resto = take - raw.reduce((soma, item) => soma + item.qtd, 0);
  raw
    .slice()
    .sort((a, b) => b.frac - a.frac)
    .forEach((item) => {
      if (resto <= 0) return;
      const alvo = raw.find((r) => r.id === item.id);
      if (!alvo) return;
      alvo.qtd += 1;
      resto -= 1;
    });
  return raw.filter((item) => item.qtd > 0).map(({ id, qtd: n }) => ({ id, qtd: n }));
}

/** Aloca cada saída nos lotes de entrada (FIFO por data; no mesmo dia, divide na proporção da sobra). */
export function alocarTudo(
  entradas: EntradaLancamento[],
  saidas: SaidaLancamento[],
): Map<string, DestinoEntrada[]> {
  const lotes = [...entradas]
    .filter(entradaValida)
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
    .map((entrada) => ({ entrada, restante: capacidadeEntrada(entrada) }));

  const destinos = new Map<string, DestinoEntrada[]>();
  const saidasOrd = [...saidas]
    .filter(saidaValida)
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));

  for (const saida of saidasOrd) {
    const volume = volumeSaida(saida);
    if (volume <= 0) continue;

    const candidatos = lotes.filter(
      (lote) =>
        lote.restante > 0 &&
        lote.entrada.data <= saida.data &&
        mercadoriasIguais(lote.entrada.mercadoria, saida.mercadoria),
    );

    const porData = new Map<string, typeof lotes>();
    for (const lote of candidatos) {
      const grupo = porData.get(lote.entrada.data) ?? [];
      grupo.push(lote);
      porData.set(lote.entrada.data, grupo);
    }

    let falta = volume;
    const partes: { entradaId: string; qtd: number }[] = [];

    for (const dataLote of [...porData.keys()].sort()) {
      if (falta <= 0) break;
      const grupo = porData.get(dataLote) ?? [];
      const shares = ratear(
        grupo.map((lote) => ({ id: lote.entrada.id, disponivel: lote.restante })),
        falta,
      );
      for (const share of shares) {
        const lote = grupo.find((item) => item.entrada.id === share.id);
        if (!lote) continue;
        lote.restante -= share.qtd;
        partes.push({ entradaId: lote.entrada.id, qtd: share.qtd });
        falta -= share.qtd;
      }
    }

    const isPerda = saida.tipo === "perda";
    let boaLeft = isPerda ? 0 : saida.boa || 0;
    let fracaLeft = isPerda ? 0 : saida.fraca || 0;
    let perdaLeft = isPerda ? volume : 0;

    partes.forEach((parte, indice) => {
      const last = indice === partes.length - 1;
      let boa = 0;
      let fraca = 0;
      let perda = 0;

      if (isPerda) {
        perda = last ? perdaLeft : parte.qtd;
        perdaLeft -= perda;
      } else {
        boa = last ? boaLeft : Math.round((parte.qtd * (saida.boa || 0)) / volume);
        fraca = parte.qtd - boa;
        if (fraca > fracaLeft) {
          fraca = fracaLeft;
          boa = parte.qtd - fraca;
        }
        if (boa > boaLeft) {
          boa = boaLeft;
          fraca = parte.qtd - boa;
        }
        boaLeft -= boa;
        fracaLeft -= fraca;
      }

      const lista = destinos.get(parte.entradaId) ?? [];
      lista.push({
        id: `${saida.id}-${parte.entradaId}`,
        cliente: isPerda ? (saida.motivo ? `Perda · ${saida.motivo}` : "Perda") : (saida.cliente ?? ""),
        data: saida.data,
        boa: boa || null,
        fraca: fraca || null,
        perda: perda || null,
        motivo: saida.motivo,
        saidaId: saida.id,
      });
      destinos.set(parte.entradaId, lista);
    });
  }

  return destinos;
}

export function consumidoDaEntrada(
  destinos: DestinoEntrada[] | undefined,
): number {
  if (!destinos) return 0;
  return destinos.reduce((soma, destino) => {
    if (destinoEhSobra(destino)) return soma;
    return soma + (destino.boa ?? 0) + (destino.fraca ?? 0) + (destino.perda ?? 0);
  }, 0);
}

export function qtdReservaEstoque(entrada: EntradaLancamento): number {
  return destinosDa(entrada)
    .filter((destino) => destinoEhSobra(destino))
    .reduce((soma, destino) => soma + (destino.fraca ?? 0) + (destino.boa ?? 0), 0);
}

export function fracaEmEstoque(entrada: EntradaLancamento, ateData?: string): number {
  const destinos = destinosDa(entrada).filter((destino) =>
    ateData ? dataDoDestino(destino, entrada) < ateData : true,
  );
  const fracaReserva = destinos
    .filter((destino) => destinoEhSobra(destino))
    .reduce((soma, destino) => soma + (destino.fraca ?? 0), 0);
  return Math.min(fracaReserva, restanteEntradaDireto(entrada, ateData));
}

export function tipoPadraoDestino(
  mercadoria: string,
  origem: "folha" | "estoque",
  entrada?: EntradaLancamento,
): string {
  if (origem === "estoque" && entrada) {
    const restante = restanteEntradaDireto(entrada);
    if (restante > 0 && fracaEmEstoque(entrada) >= restante) return "FRACO";
  }
  return ehTomate(mercadoria) ? "AAA" : "BOM";
}

export function disponivelMercadoria(
  entradas: EntradaLancamento[],
  saidas: SaidaLancamento[],
  data: string,
  mercadoria: string,
  excludeSaidaId?: string,
): number {
  const cap = entradas
    .filter((entrada) => entradaValida(entrada) && entrada.data <= data && mercadoriasIguais(entrada.mercadoria, mercadoria))
    .reduce((soma, entrada) => soma + capacidadeEntrada(entrada), 0);
  const usado = saidas
    .filter(
      (saida) =>
        saidaValida(saida) &&
        saida.data <= data &&
        mercadoriasIguais(saida.mercadoria, mercadoria) &&
        saida.id !== excludeSaidaId,
    )
    .reduce((soma, saida) => soma + volumeSaida(saida), 0);
  return Math.max(0, cap - usado);
}

export function estoqueAbertura(entradas: EntradaLancamento[], data: string): number {
  return entradas
    .filter((entrada) => entradaValida(entrada) && entrada.data < data)
    .reduce((soma, entrada) => soma + restanteEntradaDireto(entrada, data), 0);
}

export function resumoDoDia(entradas: EntradaLancamento[], data: string) {
  const estoque = estoqueAbertura(entradas, data);
  const recebido = entradas
    .filter((entrada) => entradaValida(entrada) && entrada.data === data)
    .reduce((soma, entrada) => soma + capacidadeEntrada(entrada), 0);

  let feitoBom = 0;
  let feitoFraco = 0;
  let perda = 0;
  for (const entrada of entradas) {
    for (const destino of destinosDa(entrada)) {
      if (dataDoDestino(destino, entrada) !== data) continue;
      if (destinoEhSobra(destino)) continue;
      if ((destino.perda ?? 0) > 0) perda += destino.perda ?? 0;
      else {
        feitoBom += destino.boa ?? 0;
        feitoFraco += destino.fraca ?? 0;
      }
    }
  }

  const sobra = Math.max(0, estoque + recebido - feitoBom - feitoFraco - perda);
  return { estoque, recebido, feitoBom, feitoFraco, perda, sobra };
}

export function destinosDa(entrada: EntradaLancamento): DestinoEntrada[] {
  return entrada.destinos ?? [];
}

export function dataDoDestino(destino: DestinoEntrada, entrada: EntradaLancamento): string {
  return destino.data || entrada.data;
}

export function destinosDoDia(entrada: EntradaLancamento, data: string): DestinoEntrada[] {
  return destinosDa(entrada).filter((destino) => dataDoDestino(destino, entrada) === data);
}

export function destinoDaFolha(destino: DestinoEntrada, entrada: EntradaLancamento): boolean {
  if (destino.origem === "estoque") return false;
  if (destino.origem === "folha") return true;
  return dataDoDestino(destino, entrada) === entrada.data;
}

export function destinosDaFolhaNoDia(entrada: EntradaLancamento, data: string): DestinoEntrada[] {
  return destinosDoDia(entrada, data).filter((destino) => destinoDaFolha(destino, entrada));
}

export function destinosDoEstoqueNoDia(entrada: EntradaLancamento, data: string): DestinoEntrada[] {
  return destinosDoDia(entrada, data).filter((destino) => !destinoDaFolha(destino, entrada));
}

function reservaEImplicita(entrada: EntradaLancamento, destinos: DestinoEntrada[]) {
  const vendidoFolha = consumidoDaEntrada(destinos.filter((destino) => destinoDaFolha(destino, entrada)));
  const reserva = destinos
    .filter((destino) => destinoEhSobra(destino))
    .reduce((soma, destino) => soma + (qtdDestino(destino) ?? 0), 0);
  const implicita = Math.max(0, capacidadeEntrada(entrada) - vendidoFolha);
  return implicita + Math.max(0, reserva - implicita);
}

/** Sobra que foi para o estoque no dia seguinte, antes de vender daí. 19 + 3 + 2 + 9 = 33. */
export function sobraOriginal(entrada: EntradaLancamento): number {
  return reservaEImplicita(entrada, destinosDa(entrada));
}

/** Quanto ainda resta em estoque depois das vendas feitas a partir da sobra. */
export function restanteEntradaDireto(entrada: EntradaLancamento, ateData?: string): number {
  const destinos = destinosDa(entrada).filter((destino) =>
    ateData ? dataDoDestino(destino, entrada) < ateData : true,
  );
  const vendidoEstoque = consumidoDaEntrada(destinos.filter((destino) => !destinoDaFolha(destino, entrada)));
  return Math.max(0, reservaEImplicita(entrada, destinos) - vendidoEstoque);
}

export function restanteEntrada(
  entrada: EntradaLancamento,
  destinosPorEntrada: Map<string, DestinoEntrada[]>,
): number {
  return Math.max(0, capacidadeEntrada(entrada) - consumidoDaEntrada(destinosPorEntrada.get(entrada.id)));
}

export function migrarSaidasParaDestinos(
  entradas: EntradaLancamento[],
  saidas: SaidaLancamento[],
): EntradaLancamento[] {
  const jaTemDestinos = entradas.some((entrada) => destinosDa(entrada).length > 0);
  if (jaTemDestinos) return entradas.map((entrada) => ({ ...entrada, destinos: destinosDa(entrada) }));
  const validas = saidas.filter(saidaValida);
  if (validas.length === 0) return entradas.map((entrada) => ({ ...entrada, destinos: destinosDa(entrada) }));
  const alocados = alocarTudo(entradas, saidas);
  return entradas.map((entrada) => ({
    ...entrada,
    destinos: alocados.get(entrada.id) ?? [],
  }));
}

export function saidasDerivadas(entradas: EntradaLancamento[]): SaidaLancamento[] {
  return entradas.flatMap((entrada) =>
    destinosDa(entrada)
      .filter((destino) => !destinoEhSobra(destino))
      .filter((destino) => destino.cliente.trim() || (destino.perda ?? 0) > 0 || (destino.boa ?? 0) > 0 || (destino.fraca ?? 0) > 0)
      .map((destino) => ({
        id: destino.id,
        data: dataDoDestino(destino, entrada),
        tipo: (destino.perda ?? 0) > 0 && !(destino.boa ?? 0) && !(destino.fraca ?? 0) ? "perda" : "cliente",
        cliente: destino.cliente,
        motivo: destino.motivo,
        mercadoria: entrada.mercadoria,
        boa: (destino.perda ?? 0) > 0 && !(destino.boa ?? 0) && !(destino.fraca ?? 0) ? (destino.perda ?? 0) : (destino.boa ?? 0),
        fraca: destino.fraca ?? 0,
      })),
  );
}

/** Folha do dia: só as linhas lançadas naquela data. Sobra de outro dia fica no dia da entrada e na aba Sobras. */
export function montarLinhas(entradas: EntradaLancamento[], data: string): LinhaPlanilha[] {
  return entradas
    .filter((item) => item.data === data)
    .map((entrada) => ({
      id: entrada.id,
      produtor: entrada.produtor,
      qtd: entrada.qtd || null,
      mercadoria: entrada.mercadoria,
      preco: entrada.preco,
      precoFraco: entrada.precoFraco ?? null,
      destinos: destinosDa(entrada),
      observacao: entrada.observacao,
    }));
}

export function ordemDeLancamento(entradas: EntradaLancamento[]): Map<string, number> {
  return new Map(entradas.map((entrada, indice) => [entrada.id, indice]));
}

export function compararLancamento(ordem: Map<string, number>, aId: string, bId: string): number {
  return (ordem.get(aId) ?? Number.MAX_SAFE_INTEGER) - (ordem.get(bId) ?? Number.MAX_SAFE_INTEGER);
}

export function sobrasAtuais(entradas: EntradaLancamento[]) {
  const ordem = ordemDeLancamento(entradas);
  return entradas
    .filter(entradaValida)
    .map((entrada) => ({
      entrada,
      restante: restanteEntradaDireto(entrada),
      original: sobraOriginal(entrada),
      consumido: consumidoDaEntrada(destinosDa(entrada)),
    }))
    .filter((item) => item.original > 0 || item.restante > 0)
    .sort(
      (a, b) =>
        a.entrada.data.localeCompare(b.entrada.data) || compararLancamento(ordem, a.entrada.id, b.entrada.id),
    );
}

/** Sobra ainda em estoque, agrupada por dia — na ordem em que a carga foi lançada.
 *  Só entra no estoque no dia seguinte ao lançamento, nunca na folha do mesmo dia.
 *  A quantidade é a sobra original lançada no destino do dia anterior. */
export function sobrasPorDia(entradas: EntradaLancamento[], dataFolha?: string) {
  const porDia = new Map<
    string,
    { entradaId: string; produtor: string; mercadoria: string; restante: number; original: number; fraca: number }[]
  >();

  for (const item of sobrasAtuais(entradas)) {
    if (dataFolha && item.entrada.data >= dataFolha) continue;
    if (item.original <= 0 && item.restante <= 0) continue;
    const dia = item.entrada.data;
    const lista = porDia.get(dia) ?? [];
    lista.push({
      entradaId: item.entrada.id,
      produtor: item.entrada.produtor || "Sem fornecedor",
      mercadoria: item.entrada.mercadoria,
      restante: item.restante,
      original: item.original,
      fraca: fracaEmEstoque(item.entrada, dataFolha),
    });
    porDia.set(dia, lista);
  }

  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, linhas]) => {
      const itens = linhas.map((item) => ({ ...item, abrev: abrevMercadoria(item.mercadoria) }));
      return {
        data,
        itens,
        total: itens.reduce((soma, item) => soma + (item.original || item.restante), 0),
      };
    });
}

export function ultimaEntradaDaMercadoria(
  entradas: EntradaLancamento[],
  data: string,
  mercadoria: string,
): EntradaLancamento | undefined {
  return [...entradas]
    .filter((entrada) => entrada.data <= data && mercadoriasIguais(entrada.mercadoria, mercadoria))
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
    .at(-1);
}
