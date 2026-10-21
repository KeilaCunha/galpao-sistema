import { Bell, Database, Leaf, Palette, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { cn } from "../utils/cn";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-brand-600" : "bg-neutral-200",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function SettingRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-neutral-700">{title}</p>
        <p className="text-xs text-neutral-400">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function Configuracoes() {
  const [notifEstoque, setNotifEstoque] = useState(true);
  const [notifAnotacoes, setNotifAnotacoes] = useState(true);
  const [notifResumo, setNotifResumo] = useState(false);
  const [modoCompacto, setModoCompacto] = useState(false);
  const [autenticacaoDoisFatores, setAutenticacaoDoisFatores] = useState(false);

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Preferências visuais do sistema. Nesta etapa, as opções abaixo são apenas demonstrativas."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Perfil */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-900/5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <User size={18} />
            </span>
            <h2 className="text-sm font-semibold text-neutral-800">Perfil do usuário</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <User size={28} strokeWidth={2} />
            </span>
            <div>
              <p className="text-base font-semibold text-neutral-800">Usuário do sistema</p>
              <p className="text-sm text-neutral-500">Perfil de demonstração</p>
            </div>
          </div>
        </div>

        {/* Notificações */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-900/5">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Bell size={18} />
            </span>
            <h2 className="text-sm font-semibold text-neutral-800">Notificações</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            <SettingRow
              title="Alertas de estoque baixo"
              description="Avisar quando um produto atingir o estoque mínimo."
              checked={notifEstoque}
              onChange={setNotifEstoque}
            />
            <SettingRow
              title="Novas anotações"
              description="Avisar quando uma anotação for registrada."
              checked={notifAnotacoes}
              onChange={setNotifAnotacoes}
            />
            <SettingRow
              title="Resumo diário por e-mail"
              description="Receber um resumo das movimentações do dia."
              checked={notifResumo}
              onChange={setNotifResumo}
            />
          </div>
        </div>

        {/* Aparência */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-900/5">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Palette size={18} />
            </span>
            <h2 className="text-sm font-semibold text-neutral-800">Aparência</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            <SettingRow
              title="Modo compacto"
              description="Reduz o espaçamento das tabelas e listas."
              checked={modoCompacto}
              onChange={setModoCompacto}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {["#2f6638", "#3f8049", "#1f3f26", "#707b76"].map((cor) => (
              <span
                key={cor}
                className="h-8 w-8 rounded-full border-2 border-white shadow-sm ring-1 ring-neutral-200"
                style={{ backgroundColor: cor }}
              />
            ))}
            <span className="ml-2 text-xs text-neutral-400">Paleta atual do sistema</span>
          </div>
        </div>

        {/* Segurança */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-900/5">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ShieldCheck size={18} />
            </span>
            <h2 className="text-sm font-semibold text-neutral-800">Segurança</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            <SettingRow
              title="Autenticação em duas etapas"
              description="Camada extra de segurança ao acessar o sistema."
              checked={autenticacaoDoisFatores}
              onChange={setAutenticacaoDoisFatores}
            />
          </div>
        </div>

        {/* Sobre o sistema */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-900/5 xl:col-span-2">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Database size={18} />
            </span>
            <h2 className="text-sm font-semibold text-neutral-800">Sobre o sistema</h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-neutral-500">
            <div className="flex items-center gap-1.5">
              <Leaf size={14} className="text-brand-600" />
              <span className="font-medium text-neutral-700">Galpão</span> — versão 1.0.0 (demonstração)
            </div>
            <span>Frontend: React + TypeScript + Vite + Tailwind CSS</span>
            <span>Dados fictícios — sem conexão com banco de dados</span>
          </div>
        </div>
      </div>
    </div>
  );
}
