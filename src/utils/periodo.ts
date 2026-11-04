import { addDays, toISODate } from "./format";

export function inicioSemana(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return toISODate(date);
}

export function fimSemana(iso: string): string {
  return addDays(inicioSemana(iso), 6);
}

export function inicioMes(iso: string): string {
  const [y, m] = iso.split("-");
  return `${y}-${m}-01`;
}

export function fimMes(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return toISODate(new Date(y, m, 0));
}

export function datasNoIntervalo(de: string, ate: string): string[] {
  if (!de || !ate || de > ate) return [];
  const dias: string[] = [];
  let atual = de;
  while (atual <= ate) {
    dias.push(atual);
    atual = addDays(atual, 1);
  }
  return dias;
}
