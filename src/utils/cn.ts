export type ClassValue = string | number | boolean | null | undefined | ClassValue[];

/** Utilitário simples para combinar classes condicionalmente */
export function cn(...values: ClassValue[]): string {
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) result.push(nested);
    } else {
      result.push(String(value));
    }
  }
  return result.join(" ");
}
