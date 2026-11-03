/** Formata um número como moeda brasileira: R$ 0,00 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Formata uma data ISO (yyyy-mm-dd ou com horário) para DD/MM/AAAA */
export function formatDate(isoDate: string): string {
  if (!isoDate) return "-";
  const [datePart] = isoDate.split("T");
  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

/** Formata data e hora ISO para DD/MM/AAAA às HH:mm */
export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return formatDate(isoDate);
  const d = formatDate(isoDate);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${d} às ${h}:${m}`;
}

/** Converte uma data no formato DD/MM/AAAA (ou parcial) para ISO yyyy-mm-dd */
export function toISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Soma (ou subtrai) dias a uma data ISO (yyyy-mm-dd), retornando uma nova data ISO */
export function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + delta);
  return toISODate(date);
}

/** Retorna o nome do dia da semana (capitalizado) para uma data ISO */
export function weekdayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const nome = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** Formata data ISO como "26 de novembro de 2026" */
export function formatDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** Formata número com separador de milhar (padrão brasileiro) */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** Formata quantidade com unidade de medida */
export function formatQuantidade(value: number, unidadeLabel: string): string {
  return `${formatNumber(value)} ${unidadeLabel}`;
}

/** Aplica máscara simples de CPF/CNPJ conforme a quantidade de dígitos */
export function maskDocumento(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Aplica máscara simples de telefone */
export function maskTelefone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}
