let counter = 0;

/** Gera um id único simples para uso em memória (sem backend) */
export function generateId(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
