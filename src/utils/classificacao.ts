import type { DestinoEntrada } from "../types";

export const TIPOS_TOMATE = ["AAA", "AA", "A", "FRACO", "Saladão", "Verde"] as const;
export const TIPOS_PADRAO = ["BOM", "GRAUDO", "FRACO"] as const;

function semAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function ehTomate(mercadoria: string): boolean {
  const base = mercadoria.trim().split(/\s+/)[0] ?? "";
  return semAcento(base) === "tomate";
}

export function tiposDaMercadoria(mercadoria: string): string[] {
  return ehTomate(mercadoria) ? [...TIPOS_TOMATE] : [...TIPOS_PADRAO];
}

export function tipoEhPerda(tipo?: string): boolean {
  return semAcento(tipo ?? "") === "perda";
}

export function tipoEhEstoque(tipo?: string): boolean {
  const chave = semAcento(tipo ?? "");
  return chave === "estoque" || chave === "sobra";
}

/** Sobra para o outro dia: tipo Estoque/Sobra ou cliente Estoque/Sobra. */
export function destinoEhSobra(destino: { tipo?: string; cliente?: string }): boolean {
  if (tipoEhEstoque(destino.tipo)) return true;
  const cliente = semAcento(destino.cliente ?? "");
  return cliente === "estoque" || cliente === "sobra";
}

export function tipoEhFraco(tipo?: string): boolean {
  return semAcento(tipo ?? "") === "fraco";
}

export function labelTipo(mercadoria: string, tipo: string): string {
  if (tipoEhEstoque(tipo)) return "Sobra";
  if (ehTomate(mercadoria)) return `Tomate ${tipo === "Verde" ? "verde" : tipo}`;
  return tipo;
}

export function opcoesClassificacao(
  mercadoria: string,
  origemEstoque = false,
): { value: string; label: string }[] {
  return [
    ...tiposDaMercadoria(mercadoria).map((tipo) => ({
      value: tipo,
      label: labelTipo(mercadoria, tipo),
    })),
    ...(!origemEstoque ? [{ value: "Estoque", label: "Sobra" }] : []),
    { value: "Perda", label: "Perda" },
  ];
}

export function abrevTipo(tipo?: string): string {
  const chave = semAcento(tipo ?? "");
  if (chave === "bom" || chave === "graudo" || chave === "aaa") return "";
  if (chave === "estoque") return "";
  if (chave === "fraco") return "FR";
  if (chave === "saladao") return "SAL";
  if (chave === "verde") return "VD";
  return (tipo ?? "").toUpperCase();
}

export function qtdDestino(destino: DestinoEntrada): number | null {
  if (tipoEhPerda(destino.tipo)) return destino.perda ?? destino.boa ?? destino.fraca;
  if (tipoEhFraco(destino.tipo)) return destino.fraca ?? destino.boa;
  if (tipoEhEstoque(destino.tipo)) return destino.boa ?? destino.fraca;
  return destino.boa ?? destino.fraca;
}

export function patchQtd(
  tipo: string | undefined,
  qtd: number | null,
): Pick<DestinoEntrada, "boa" | "fraca" | "perda"> {
  if (tipoEhPerda(tipo)) return { boa: null, fraca: null, perda: qtd };
  if (tipoEhFraco(tipo)) return { boa: null, fraca: qtd, perda: null };
  if (tipoEhEstoque(tipo)) return { boa: qtd, fraca: null, perda: null };
  return { boa: qtd, fraca: null, perda: null };
}

export function patchTipo(tipo: string, destino: DestinoEntrada): Partial<DestinoEntrada> {
  return { tipo, ...patchQtd(tipo, qtdDestino(destino)) };
}

export type ResumoFeitaTomate = {
  bom: number;
  aa: number;
  a: number;
  fr: number;
  perda: number;
};

/** AAA, Saladão e Verde entram como bom. AA, A e FRACO ficam separados. */
export function grupoTipoTomate(tipo?: string): keyof ResumoFeitaTomate {
  const chave = semAcento(tipo ?? "");
  if (chave === "perda") return "perda";
  if (chave === "fraco") return "fr";
  if (chave === "aa") return "aa";
  if (chave === "a") return "a";
  return "bom";
}

export function nomeTipoCliente(tipo?: string, fraco = false): string {
  if (fraco || tipoEhFraco(tipo)) return "fraco";
  return abrevTipo(tipo);
}

export function ordemClassificacao(mercadoria: string, tipo: string): number {
  const lista = ehTomate(mercadoria)
    ? ["aaa", "aa", "a", "saladao", "verde", "fraco", "boa", "fraca"]
    : ["bom", "graudo", "fraco", "boa", "fraca"];
  const i = lista.indexOf(semAcento(tipo));
  return i === -1 ? 50 : i;
}

export function resumoFeitaTomate(destinos: DestinoEntrada[], _qtdMeta?: number | null): ResumoFeitaTomate {
  const resumo: ResumoFeitaTomate = { bom: 0, aa: 0, a: 0, fr: 0, perda: 0 };
  for (const destino of destinos) {
    if (tipoEhEstoque(destino.tipo)) {
      resumo.bom += destino.boa ?? 0;
      resumo.fr += destino.fraca ?? 0;
      continue;
    }
    if (!tipoEhPerda(destino.tipo)) resumo.perda += destino.perda ?? 0;
    const qtd = qtdDestino(destino) ?? 0;
    if (qtd <= 0) continue;
    const semTipo = !destino.tipo?.trim();
    const soFraca = semTipo && (destino.fraca ?? 0) > 0 && !(destino.boa ?? 0);
    const grupo = soFraca ? "fr" : grupoTipoTomate(destino.tipo);
    resumo[grupo] += qtd;
  }
  return resumo;
}
