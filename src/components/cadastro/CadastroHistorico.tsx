import { useEffect, useState } from "react";
import { api, apiRemota } from "../../api/http";
import { formatDateTime } from "../../utils/format";
import {
  ehEventoCadastro,
  fraseAuditoria,
  type EventoAuditoria,
} from "../../utils/auditoria";

export function CadastroHistorico() {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);

  useEffect(() => {
    if (!apiRemota) return;
    let cancelado = false;

    async function carregar() {
      try {
        const lista = await api.get<EventoAuditoria[]>("/auditoria?limite=200");
        if (!cancelado) setEventos(lista.filter(ehEventoCadastro));
      } catch {
        if (!cancelado) setEventos([]);
      }
    }

    void carregar();
    const timer = window.setInterval(() => void carregar(), 4000);
    return () => {
      cancelado = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-800">Histórico de cadastros</h2>
        <p className="mt-0.5 text-xs text-neutral-400">Quem cadastrou, alterou ou excluiu produto, fornecedor e cliente.</p>
      </div>
      {eventos.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-neutral-400">
          Ainda não há histórico. Assim que alguém cadastrar, aparece aqui com o nome de quem fez.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {eventos.map((evento) => (
            <li key={evento.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
              <p className="text-sm text-neutral-800">{fraseAuditoria(evento)}</p>
              <p className="shrink-0 text-xs text-neutral-400">{formatDateTime(evento.criadoEm)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
