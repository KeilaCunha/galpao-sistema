import { cn } from "../../utils/cn";
import type { Situacao, SituacaoEstoque } from "../../types";

const SITUACAO_CLASSES: Record<Situacao, string> = {
  ativo: "bg-success-50 text-success-600 border-success-500/20",
  inativo: "bg-neutral-100 text-neutral-500 border-neutral-300",
};

const SITUACAO_LABEL: Record<Situacao, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

export function SituacaoBadge({ situacao }: { situacao: Situacao }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        SITUACAO_CLASSES[situacao],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", situacao === "ativo" ? "bg-success-500" : "bg-neutral-400")} />
      {SITUACAO_LABEL[situacao]}
    </span>
  );
}

const ESTOQUE_CLASSES: Record<SituacaoEstoque, string> = {
  normal: "bg-success-50 text-success-600 border-success-500/20",
  baixo: "bg-warning-50 text-warning-600 border-warning-500/30",
  "sem-estoque": "bg-danger-50 text-danger-600 border-danger-500/20",
};

const ESTOQUE_LABEL: Record<SituacaoEstoque, string> = {
  normal: "Estoque normal",
  baixo: "Estoque baixo",
  "sem-estoque": "Sem estoque",
};

const ESTOQUE_DOT: Record<SituacaoEstoque, string> = {
  normal: "bg-success-500",
  baixo: "bg-warning-500",
  "sem-estoque": "bg-danger-500",
};

export function EstoqueBadge({ situacao }: { situacao: SituacaoEstoque }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        ESTOQUE_CLASSES[situacao],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ESTOQUE_DOT[situacao])} />
      {ESTOQUE_LABEL[situacao]}
    </span>
  );
}
