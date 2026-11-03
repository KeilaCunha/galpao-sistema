import type { EntradaLancamento, SaidaLancamento } from "../types";

/** Folha de demonstração — o sistema abre neste dia para o teste do fluxo. */
export const DATA_FOLHA_INICIAL = "2026-11-26";

export const entradasDemo: EntradaLancamento[] = [
  {
    id: "ent-nielso-ab",
    data: DATA_FOLHA_INICIAL,
    produtor: "Nielso",
    mercadoria: "Abobrinha",
    qtd: 100,
    preco: null,
  },
  {
    id: "ent-jc-jilo",
    data: DATA_FOLHA_INICIAL,
    produtor: "José Carlos",
    mercadoria: "Jiló",
    qtd: 10,
    preco: null,
  },
];

export const saidasDemo: SaidaLancamento[] = [
  { id: "sai-dr-ab", data: DATA_FOLHA_INICIAL, tipo: "cliente", cliente: "DR", mercadoria: "Abobrinha", boa: 20, fraca: 10 },
  { id: "sai-se-ab", data: DATA_FOLHA_INICIAL, tipo: "cliente", cliente: "SE", mercadoria: "Abobrinha", boa: 30, fraca: 0 },
  { id: "sai-sm-ab", data: DATA_FOLHA_INICIAL, tipo: "cliente", cliente: "SM", mercadoria: "Abobrinha", boa: 10, fraca: 0 },
  { id: "sai-sm-jilo", data: DATA_FOLHA_INICIAL, tipo: "cliente", cliente: "SM", mercadoria: "Jiló", boa: 6, fraca: 0 },
  { id: "sai-nf-jilo", data: DATA_FOLHA_INICIAL, tipo: "cliente", cliente: "NF", mercadoria: "Jiló", boa: 2, fraca: 0 },
  { id: "sai-mn-jilo", data: DATA_FOLHA_INICIAL, tipo: "cliente", cliente: "MN", mercadoria: "Jiló", boa: 1, fraca: 0 },
  { id: "sai-dr-jilo", data: DATA_FOLHA_INICIAL, tipo: "cliente", cliente: "DR", mercadoria: "Jiló", boa: 0, fraca: 1 },
];
