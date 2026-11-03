/** Abreviação de mercadoria para chips (Abobrinha → AB, Jiló → JILÓ) */
export function abrevMercadoria(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeiro = partes[0];
  const resto = partes.slice(1).join(" ");
  const abrev = primeiro.length <= 5 ? primeiro.toUpperCase() : primeiro.slice(0, 2).toUpperCase();
  return resto ? `${abrev} ${resto.toUpperCase()}` : abrev;
}

/** Abreviação do cliente para chips da folha (Mercado Bom → MB, DR → DR) */
export function abrevCliente(nome: string): string {
  if (!nome.trim()) return "?";
  const palavras = nome.trim().split(/\s+/);
  if (palavras.length >= 2) return (palavras[0][0] + palavras[1][0]).toUpperCase();
  return nome.slice(0, 4).toUpperCase();
}

function semAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function chaveMercadoria(nome: string): string {
  return semAcento(nome).replace(/\s+/g, " ");
}

/** Compara nomes/abreviações de mercadoria (Abobrinha ≡ AB ≡ abobrinha italiana só se for o mesmo produto base + tipo). */
export function mercadoriasIguais(a: string, b: string): boolean {
  const ka = chaveMercadoria(a);
  const kb = chaveMercadoria(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;

  const abrevA = semAcento(abrevMercadoria(a));
  const abrevB = semAcento(abrevMercadoria(b));
  if (abrevA === kb || abrevB === ka) return true;
  if (abrevA === abrevB && abrevA.length >= 2) return true;

  return false;
}
