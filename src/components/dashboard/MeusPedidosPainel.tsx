import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { usePlanilha } from "../../context/PlanilhaContext";
import { generateId } from "../../utils/id";
import { compararPedidosComFolha, mesmaChave, pedidoPersistivel } from "../../utils/pedido";
import { Autocomplete } from "../ui/Autocomplete";

const LINHAS_VAZIAS = 8;
const cellClass =
  "h-9 w-full rounded-md bg-transparent px-2 text-sm text-neutral-700 placeholder:text-neutral-300 outline-none transition focus:bg-brand-50/70 focus:ring-2 focus:ring-brand-300";

type LinhaRascunho = { id: string; cliente: string; mercadoria: string; qtd: number };

function rascunhoVazio(): LinhaRascunho {
  return { id: generateId("pedr"), cliente: "", mercadoria: "", qtd: 0 };
}

function cadastrado(nome: string, lista: string[]): boolean {
  return lista.some((item) => mesmaChave(item, nome));
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

export function MeusPedidosPainel({ dia }: { dia: string }) {
  const { entradas, pedidos, definirPedido, removePedido } = usePlanilha();
  const { clientes, produtos } = useData();
  const [rascunhos, setRascunhos] = useState<LinhaRascunho[]>(() =>
    Array.from({ length: LINHAS_VAZIAS }, rascunhoVazio),
  );

  useEffect(() => {
    setRascunhos(Array.from({ length: LINHAS_VAZIAS }, rascunhoVazio));
  }, [dia]);

  const nomesClientes = useMemo(
    () =>
      [...new Set(clientes.map((item) => item.nome.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [clientes],
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

  const comparacao = useMemo(
    () => compararPedidosComFolha(entradas, pedidos, dia),
    [entradas, pedidos, dia],
  );
  const totais = useMemo(() => {
    const falta = comparacao.filter((linha) => linha.status === "falta");
    const passou = comparacao.filter((linha) => linha.status === "passou");
    return {
      feito: comparacao.reduce((soma, linha) => soma + linha.feito, 0),
      falta: falta.reduce((soma, linha) => soma + linha.diferenca, 0),
      passou: passou.reduce((soma, linha) => soma + linha.diferenca, 0),
      itensFalta: falta.length,
      itensPassou: passou.length,
    };
  }, [comparacao]);

  useEffect(() => {
    setRascunhos((prev) => {
      const vazios = prev.filter(
        (linha) => !linha.cliente.trim() && !linha.mercadoria.trim() && linha.qtd <= 0,
      ).length;
      if (vazios >= LINHAS_VAZIAS) return prev;
      return [...prev, ...Array.from({ length: LINHAS_VAZIAS - vazios }, rascunhoVazio)];
    });
  }, [rascunhos]);

  function podeGravar(cliente: string, mercadoria: string): boolean {
    return cadastrado(cliente, nomesClientes) && cadastrado(mercadoria, mercadorias);
  }

  function idsDoPedido(cliente: string, mercadoria: string): string[] {
    return pedidos
      .filter(
        (pedido) =>
          pedido.data === dia &&
          mesmaChave(pedido.cliente, cliente) &&
          mesmaChave(pedido.mercadoria, mercadoria),
      )
      .map((pedido) => pedido.id);
  }

  function aplicarPedido(cliente: string, mercadoria: string, qtd: number) {
    if (!podeGravar(cliente, mercadoria)) return;
    definirPedido({
      data: dia,
      cliente: cliente.trim(),
      mercadoria: mercadoria.trim(),
      qtd,
    });
  }

  function aplicarRascunho(id: string, patch: Partial<LinhaRascunho>) {
    const atual = rascunhos.find((linha) => linha.id === id);
    if (!atual) return;
    const proximo = { ...atual, ...patch };
    if (
      pedidoPersistivel({ ...proximo, data: dia, tipo: "BOM" }) &&
      podeGravar(proximo.cliente, proximo.mercadoria)
    ) {
      definirPedido({
        data: dia,
        cliente: proximo.cliente.trim(),
        mercadoria: proximo.mercadoria.trim(),
        tipo: "BOM",
        qtd: proximo.qtd,
      });
      setRascunhos((prev) => prev.filter((linha) => linha.id !== id));
      return;
    }
    setRascunhos((prev) => prev.map((linha) => (linha.id === id ? proximo : linha)));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600">Pedido × folha do dia</h3>
        <p className="mt-0.5 text-xs text-neutral-400">
          Você anota cliente, mercadoria e pedido. O feito e a situação entram sozinhos do que saiu na folha. Só
          entra o que já está no cadastro.
        </p>
      </div>

      <div className="grid gap-3 border-b border-neutral-100 px-4 py-3 sm:grid-cols-3 sm:px-5">
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5">
          <p className="text-xl font-bold tabular-nums text-brand-800">{totais.feito}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Feito na folha</p>
        </div>
        <div className="rounded-xl bg-warning-50 px-3 py-2.5">
          <p className="text-xl font-bold tabular-nums text-warning-700">{totais.falta}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warning-700">
            Falta · {totais.itensFalta} {totais.itensFalta === 1 ? "item" : "itens"}
          </p>
        </div>
        <div className="rounded-xl bg-danger-50 px-3 py-2.5">
          <p className="text-xl font-bold tabular-nums text-danger-600">{totais.passou}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-danger-600">
            Passou · {totais.itensPassou} {totais.itensPassou === 1 ? "item" : "itens"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm" translate="no">
          <thead>
            <tr className="bg-neutral-50">
              <th className="min-w-[12rem] px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Cliente
              </th>
              <th className="min-w-[12rem] px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Mercadoria
              </th>
              <th className="w-28 min-w-28 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Pedido
              </th>
              <th className="w-24 min-w-24 px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Feito
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Situação
              </th>
              <th className="w-10 min-w-10" />
            </tr>
          </thead>
          <tbody>
            {comparacao.map((linha) => {
              const temPedido = linha.pedido > 0;
              return (
                <tr key={`${linha.cliente}-${linha.mercadoria}`} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5 font-semibold text-neutral-800">{linha.cliente}</td>
                  <td className="px-3 py-1.5 text-neutral-800">{linha.mercadoria}</td>
                  <td className="p-1 align-middle">
                    <CampoQtd
                      valor={linha.pedido}
                      onDefinir={(qtd) => aplicarPedido(linha.cliente, linha.mercadoria, qtd)}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums">{linha.feito || "—"}</td>
                  <td className="px-3 py-1.5">
                    {linha.status === "falta" ? (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-warning-700">
                        Falta {linha.diferenca}
                      </span>
                    ) : linha.status === "passou" ? (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-danger-500">
                        Passou {linha.diferenca}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-success-600">Bate</span>
                    )}
                  </td>
                  <td className="p-1 text-center">
                    {temPedido && (
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-neutral-300 hover:bg-danger-50 hover:text-danger-500"
                        aria-label="Excluir pedido"
                        onClick={() => idsDoPedido(linha.cliente, linha.mercadoria).forEach(removePedido)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rascunhos.map((linha) => (
              <tr key={linha.id} className="border-t border-neutral-50">
                <td className="p-1 align-top">
                  <Autocomplete
                    compact
                    tipoItem="cliente"
                    value={linha.cliente}
                    onChange={(cliente) => aplicarRascunho(linha.id, { cliente })}
                    sugestoes={nomesClientes}
                    placeholder="Cliente"
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
                <td className="px-3 py-1.5 text-right text-neutral-300">—</td>
                <td className="px-3 py-1.5 text-neutral-300">—</td>
                <td className="p-1 text-center">
                  {(linha.cliente.trim() || linha.mercadoria.trim() || linha.qtd > 0) && (
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
