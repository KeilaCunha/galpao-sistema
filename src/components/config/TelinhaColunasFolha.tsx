import type { VisibilidadeFolha } from "../../utils/permissoes";
import { ROTULOS_COLUNA_FOLHA } from "../../utils/permissoes";

export function TelinhaColunasFolha({
  valor,
  onChange,
  somenteLeitura,
}: {
  valor: VisibilidadeFolha;
  onChange?: (proxima: VisibilidadeFolha) => void;
  somenteLeitura?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Folha do dia</p>
        <p className="text-[10px] text-neutral-400">Clique na coluna para esconder ou mostrar</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {ROTULOS_COLUNA_FOLHA.map((item, i) => {
          const ligada = valor[item.chave];
          return (
            <button
              key={item.chave}
              type="button"
              disabled={somenteLeitura || !onChange}
              title={item.detalhe}
              onClick={() => onChange?.({ ...valor, [item.chave]: !ligada })}
              className={`flex flex-col items-center justify-center gap-0.5 border-neutral-200 px-2 py-3 text-center ${
                i > 0 ? "border-l" : ""
              } ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i >= 3 ? "lg:border-t-0" : ""} ${
                ligada
                  ? "bg-white text-neutral-800"
                  : "bg-neutral-100 text-neutral-400 line-through"
              } ${somenteLeitura || !onChange ? "cursor-default" : "cursor-pointer hover:bg-brand-50"}`}
            >
              <span className="text-xs font-semibold">{item.titulo}</span>
              <span className={`text-[10px] font-medium ${ligada ? "text-success-600" : "text-neutral-400"}`}>
                {ligada ? "visível" : "oculto"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function resumoColunasFolha(valor: VisibilidadeFolha): string {
  const visiveis = ROTULOS_COLUNA_FOLHA.filter((item) => valor[item.chave]).map((item) => item.titulo);
  const ocultas = ROTULOS_COLUNA_FOLHA.filter((item) => !valor[item.chave]).map((item) => item.titulo);
  const parteVisivel = visiveis.length ? visiveis.join(" · ") : "nada visível";
  if (!ocultas.length) return parteVisivel;
  return `${parteVisivel} (oculta: ${ocultas.join(", ")})`;
}
