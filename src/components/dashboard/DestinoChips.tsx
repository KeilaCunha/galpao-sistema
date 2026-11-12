import type { DestinoEntrada } from "../../types";
import { abrevCliente } from "../../utils/abrev";
import { abrevTipo, qtdDestino, tipoEhEstoque, tipoEhFraco, tipoEhPerda } from "../../utils/classificacao";

export function DestinoChips({ destinos }: { destinos: DestinoEntrada[] }) {
  return (
    <>
      {destinos.map((destino) => {
        const tipo = destino.tipo?.trim();
        const qtd = qtdDestino(destino) ?? 0;
        const soFraca = !tipo && (destino.fraca ?? 0) > 0 && !(destino.boa ?? 0);
        const osDois = !tipo && (destino.boa ?? 0) > 0 && (destino.fraca ?? 0) > 0;
        const fraco = tipoEhFraco(tipo) || soFraca;
        const ehPerda = tipoEhPerda(tipo);
        const ehEstoque = tipoEhEstoque(tipo);
        return (
          <span key={destino.id} className="contents">
            {ehEstoque ? (
              qtd > 0 ? (
                <span className="inline-flex items-center rounded-md bg-warning-50 px-2 py-0.5 text-xs font-bold text-warning-700">
                  {qtd} sobra
                  {(destino.fraca ?? 0) > 0 && !(destino.boa ?? 0) ? (
                    <sup className="ml-0.5 text-[9px] font-extrabold">fr</sup>
                  ) : null}
                </span>
              ) : null
            ) : ehPerda ? (
              (destino.perda ?? qtd) > 0 ? (
                <span className="inline-flex items-center rounded-md bg-danger-50 px-2 py-0.5 text-xs font-bold text-danger-600">
                  {destino.perda ?? qtd} perda
                </span>
              ) : null
            ) : osDois ? (
              <>
                <span className="inline-flex items-center rounded-md bg-success-50 px-2 py-0.5 text-xs font-bold text-success-700">
                  {destino.boa} {abrevCliente(destino.cliente)}
                </span>
                <span className="inline-flex items-center rounded-md bg-warning-50 px-2 py-0.5 text-xs font-bold text-warning-700">
                  {destino.fraca} {abrevCliente(destino.cliente)}
                  <sup className="ml-0.5 text-[9px] font-extrabold">fr</sup>
                </span>
              </>
            ) : qtd > 0 ? (
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
                  fraco ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"
                }`}
              >
                {qtd} {abrevCliente(destino.cliente)}
                {abrevTipo(tipo) ? ` ${abrevTipo(tipo)}` : fraco ? <sup className="ml-0.5 text-[9px] font-extrabold">fr</sup> : null}
              </span>
            ) : null}
            {!ehPerda && !ehEstoque && (destino.perda ?? 0) > 0 && (
              <span className="inline-flex items-center rounded-md bg-danger-50 px-2 py-0.5 text-xs font-bold text-danger-600">
                {destino.perda} perda
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}
