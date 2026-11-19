import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { usePlanilha } from "../../context/PlanilhaContext";
import type { PrevisaoFornecedor } from "../../types";
import { previsaoPersistivel, totaisBasePorMercadoria } from "../../utils/analise";
import { generateId } from "../../utils/id";
import { mesmaChave } from "../../utils/pedido";
import { Autocomplete } from "../ui/Autocomplete";
import { SearchInput } from "../ui/SearchInput";

const LINHAS_VAZIAS = 6;
const cellClass =
  "h-9 w-full rounded-md bg-transparent px-2 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300";

type LinhaRascunho = { id: string; fornecedor: string; mercadoria: string; qtd: number };

function rascunhoVazio(): LinhaRascunho {
  return { id: generateId("prevr"), fornecedor: "", mercadoria: "", qtd: 0 };
}

function CampoQtd({
  valor,
  onDefinir,
}: {
  valor: number;
  onDefinir: (qtd: number) => void;
}) {
  const [focado, setFocado] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const preenchido = valor > 0 || (focado && rascunho.trim().length > 0);

  function aplicar(texto: string) {
    const limpo = texto.trim().replace(",", ".");
    if (!limpo) {
      onDefinir(0);
      return;
    }
    const quantidade = Number(limpo);
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      onDefinir(0);
      return;
    }
    onDefinir(quantidade);
  }

  return (
    <input
      className={`${cellClass} text-center font-semibold tabular-nums ${
        preenchido ? "bg-brand-50/70" : ""
      }`}
      placeholder="—"
      inputMode="numeric"
      value={focado ? rascunho : valor > 0 ? String(valor) : ""}
      onFocus={() => {
        setFocado(true);
        setRascunho(valor > 0 ? String(valor) : "");
      }}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        setFocado(false);
        aplicar(rascunho);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
      }}
    />
  );
}

function corresponde(texto: string, filtro: string): boolean {
  if (!filtro.trim()) return true;
  return mesmaChave(texto, filtro) || texto.toLowerCase().includes(filtro.trim().toLowerCase());
}

export function AnalisePainel({ dia }: { dia: string }) {
  const { previsoes, definirPrevisao, atualizarPrevisao, removePrevisao } = usePlanilha();
  const { produtos, fornecedores } = useData();
  const [busca, setBusca] = useState("");
  const [rascunhos, setRascunhos] = useState<LinhaRascunho[]>(() =>
    Array.from({ length: LINHAS_VAZIAS }, rascunhoVazio),
  );

  useEffect(() => {
    setBusca("");
    setRascunhos(Array.from({ length: LINHAS_VAZIAS }, rascunhoVazio));
  }, [dia]);

  const nomesFornecedores = useMemo(
    () =>
      [...new Set(fornecedores.map((item) => item.nome.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [fornecedores],
  );
  const mercadorias = useMemo(
    () =>
      [
        ...new Set(
          produtos
            .filter((item) => item.situacao === "ativo")
            .map((item) => item.nome.trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [produtos],
  );

  const doDia = useMemo(
    () => previsoes.filter((item) => item.data === dia && previsaoPersistivel(item)),
    [previsoes, dia],
  );

  useEffect(() => {
    setRascunhos((prev) => {
      const vazios = prev.filter((linha) => !linha.fornecedor.trim() && !linha.mercadoria.trim() && linha.qtd <= 0)
        .length;
      if (vazios >= LINHAS_VAZIAS) return prev;
      return [...prev, ...Array.from({ length: LINHAS_VAZIAS - vazios }, rascunhoVazio)];
    });
  }, [rascunhos]);

  const visiveis = useMemo(() => {
    const termo = busca.trim();
    if (!termo) return doDia;
    return doDia.filter(
      (item) => corresponde(item.fornecedor ?? "", termo) || corresponde(item.mercadoria, termo),
    );
  }, [doDia, busca]);

  const totaisPorMercadoria = useMemo(() => totaisBasePorMercadoria(visiveis), [visiveis]);
  const totalBase = useMemo(
    () => totaisPorMercadoria.reduce((soma, item) => soma + item.qtd, 0),
    [totaisPorMercadoria],
  );

  function aplicarSalvo(item: PrevisaoFornecedor, patch: Partial<{ fornecedor: string; mercadoria: string; qtd: number }>) {
    const proximo = { ...item, ...patch, fornecedor: (patch.fornecedor ?? item.fornecedor ?? "").trim() };
    if (!previsaoPersistivel(proximo)) {
      removePrevisao(item.id);
      return;
    }
    atualizarPrevisao(item.id, {
      fornecedor: proximo.fornecedor,
      mercadoria: proximo.mercadoria.trim(),
      qtd: proximo.qtd,
    });
  }

  function aplicarRascunho(id: string, patch: Partial<LinhaRascunho>) {
    const atual = rascunhos.find((linha) => linha.id === id);
    if (!atual) return;
    const proximo = { ...atual, ...patch };
    if (previsaoPersistivel({ ...proximo, data: dia })) {
      definirPrevisao(dia, proximo.mercadoria, proximo.qtd, proximo.fornecedor);
      setRascunhos((prev) => prev.filter((linha) => linha.id !== id));
      return;
    }
    setRascunhos((prev) => prev.map((linha) => (linha.id === id ? proximo : linha)));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600">Base que vai chegar</h3>
          <p className="mt-0.5 text-xs text-neutral-400">
            Anota a base do fornecedor para o dia de trabalho. Pedido fica em Meus pedidos, um dia antes.
          </p>
        </div>
        <SearchInput
          className="w-full max-w-xs"
          value={busca}
          onChange={setBusca}
          placeholder="Fornecedor ou mercadoria"
        />
      </div>

      <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start gap-2">
          <div className="inline-flex min-w-[8.5rem] flex-col rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5">
            <p className="text-xl font-bold tabular-nums text-brand-800">{totalBase || "—"}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Total da base</p>
          </div>
          {totaisPorMercadoria.map((item) => (
            <div
              key={item.mercadoria}
              className="inline-flex min-w-[7.5rem] flex-col rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5"
            >
              <p className="text-xl font-bold tabular-nums text-neutral-800">{item.qtd}</p>
              <p className="max-w-[10rem] truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {item.mercadoria}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm" translate="no">
          <thead>
            <tr className="bg-neutral-50">
              <th className="min-w-[12rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Fornecedor
              </th>
              <th className="min-w-[12rem] border-b border-neutral-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Mercadoria
              </th>
              <th className="w-28 min-w-28 border-b border-neutral-200 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Base
              </th>
              <th className="w-10 min-w-10 border-b border-neutral-200" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((item) => (
              <tr key={item.id} className="border-b border-neutral-50 last:border-0">
                <td className="p-1 align-top">
                  <Autocomplete
                    compact
                    tipoItem="fornecedor"
                    value={item.fornecedor ?? ""}
                    onChange={(fornecedor) => aplicarSalvo(item, { fornecedor })}
                    sugestoes={nomesFornecedores}
                    placeholder="Quem vai mandar"
                  />
                </td>
                <td className="p-1 align-top">
                  <Autocomplete
                    compact
                    tipoItem="produto"
                    value={item.mercadoria}
                    onChange={(mercadoria) => aplicarSalvo(item, { mercadoria })}
                    sugestoes={mercadorias}
                    placeholder="Mercadoria"
                  />
                </td>
                <td className="p-1 align-top">
                  <CampoQtd valor={item.qtd} onDefinir={(qtd) => aplicarSalvo(item, { qtd })} />
                </td>
                <td className="p-1 align-top text-center">
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-neutral-300 hover:bg-danger-50 hover:text-danger-500"
                    aria-label="Excluir previsão"
                    onClick={() => removePrevisao(item.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {rascunhos.map((linha) => (
              <tr key={linha.id} className="border-b border-neutral-50 last:border-0">
                <td className="p-1 align-top">
                  <Autocomplete
                    compact
                    tipoItem="fornecedor"
                    value={linha.fornecedor}
                    onChange={(fornecedor) => aplicarRascunho(linha.id, { fornecedor })}
                    sugestoes={nomesFornecedores}
                    placeholder="Quem vai mandar"
                  />
                </td>
                <td className="p-1 align-top">
                  <Autocomplete
                    compact
                    tipoItem="produto"
                    value={linha.mercadoria}
                    onChange={(mercadoria) => aplicarRascunho(linha.id, { mercadoria })}
                    sugestoes={mercadorias}
                    placeholder="Mercadoria"
                  />
                </td>
                <td className="p-1 align-top">
                  <CampoQtd valor={linha.qtd} onDefinir={(qtd) => aplicarRascunho(linha.id, { qtd })} />
                </td>
                <td className="p-1 align-top text-center">
                  {(linha.fornecedor.trim() || linha.mercadoria.trim() || linha.qtd > 0) && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-neutral-300 hover:bg-danger-50 hover:text-danger-500"
                      aria-label="Limpar linha"
                      onClick={() =>
                        setRascunhos((prev) => prev.map((item) => (item.id === linha.id ? rascunhoVazio() : item)))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
