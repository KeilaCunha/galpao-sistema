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

export function labelTipo(mercadoria: string, tipo: string): string {
  if (ehTomate(mercadoria)) return `Tomate ${tipo === "Verde" ? "verde" : tipo}`;
  return tipo;
}

export function opcoesClassificacao(mercadoria: string): { value: string; label: string }[] {
  return tiposDaMercadoria(mercadoria).map((tipo) => ({
    value: tipo,
    label: labelTipo(mercadoria, tipo),
  }));
}

export function tipoEhFraco(tipo?: string): boolean {
  return semAcento(tipo ?? "") === "fraco";
}

export function abrevTipo(tipo?: string): string {
  const chave = semAcento(tipo ?? "");
  if (chave === "fraco") return "FR";
  if (chave === "saladao") return "SAL";
  if (chave === "verde") return "VD";
  if (chave === "graudo") return "GR";
  if (chave === "bom") return "BOM";
  return (tipo ?? "").toUpperCase();
}

export function qtdDestino(destino: DestinoEntrada): number | null {
  if (tipoEhFraco(destino.tipo)) return destino.fraca ?? destino.boa;
  return destino.boa ?? destino.fraca;
}

export function patchQtd(tipo: string | undefined, qtd: number | null): Pick<DestinoEntrada, "boa" | "fraca"> {
  if (tipoEhFraco(tipo)) return { boa: null, fraca: qtd };
  return { boa: qtd, fraca: null };
}

export function patchTipo(tipo: string, destino: DestinoEntrada): Partial<DestinoEntrada> {
  return { tipo, ...patchQtd(tipo, qtdDestino(destino)) };
}
