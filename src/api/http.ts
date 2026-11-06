const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${base}/api${caminho}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(texto || `Erro ${resposta.status}`);
  }
  return (await resposta.json()) as T;
}

export async function checarBanco(): Promise<boolean> {
  try {
    const saude = await pedir<{ ok: boolean; db: boolean }>("/health");
    return Boolean(saude.ok && saude.db);
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(caminho: string) => pedir<T>(caminho),
  put: <T>(caminho: string, body: unknown) =>
    pedir<T>(caminho, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(caminho: string) => pedir<T>(caminho, { method: "DELETE" }),
};

export async function baixarBackup(nome: string): Promise<void> {
  const resposta = await fetch(`${base}/api/backup`);
  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(texto || `Erro ${resposta.status}`);
  }
  const blob = await resposta.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  link.click();
  URL.revokeObjectURL(link.href);
}
