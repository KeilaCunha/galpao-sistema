import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import {
  anotacoesMock,
  classificacoesMock,
  clientesMock,
  fornecedoresMock,
  movimentacoesMock,
  produtosMock,
} from "../data/mockData";
import type {
  Anotacao,
  Classificacao,
  Cliente,
  Fornecedor,
  MovimentacaoEstoque,
  Produto,
} from "../types";
import { generateId } from "../utils/id";
import { useLocalStorageState } from "../utils/storage";

interface DataContextValue {
  fornecedores: Fornecedor[];
  classificacoes: Classificacao[];
  produtos: Produto[];
  clientes: Cliente[];
  movimentacoes: MovimentacaoEstoque[];
  anotacoes: Anotacao[];

  addFornecedor: (data: Omit<Fornecedor, "id" | "criadoEm">) => void;
  updateFornecedor: (id: string, data: Omit<Fornecedor, "id" | "criadoEm">) => void;
  removeFornecedor: (id: string) => void;

  addClassificacao: (data: Omit<Classificacao, "id">) => void;
  updateClassificacao: (id: string, data: Omit<Classificacao, "id">) => void;
  removeClassificacao: (id: string) => void;

  addProduto: (data: Omit<Produto, "id">) => void;
  updateProduto: (id: string, data: Omit<Produto, "id">) => void;
  removeProduto: (id: string) => void;

  addCliente: (data: Omit<Cliente, "id" | "criadoEm">) => void;
  updateCliente: (id: string, data: Omit<Cliente, "id" | "criadoEm">) => void;
  removeCliente: (id: string) => void;

  addAnotacao: (data: Omit<Anotacao, "id" | "criadoEm">) => void;
  updateAnotacao: (id: string, data: Omit<Anotacao, "id" | "criadoEm">) => void;
  removeAnotacao: (id: string) => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [fornecedores, setFornecedores] = useLocalStorageState<Fornecedor[]>("fornecedores", fornecedoresMock);
  const [classificacoes, setClassificacoes] = useLocalStorageState<Classificacao[]>(
    "classificacoes",
    classificacoesMock,
  );
  const [produtos, setProdutos] = useLocalStorageState<Produto[]>("produtos", produtosMock);

  // Migração: normaliza tipos que foram salvos como string única com vírgulas
  // Ex: tipos: ["A , AA , AAA"] → tipos: ["A", "AA", "AAA"]
  useEffect(() => {
    const precisaNormalizar = produtos.some((p) =>
      (p.tipos ?? []).some((t) => t.includes(",")),
    );
    if (!precisaNormalizar) return;
    setProdutos((prev) =>
      prev.map((p) => ({
        ...p,
        tipos: (p.tipos ?? []).flatMap((t) =>
          t.includes(",") ? t.split(",").map((s) => s.trim()).filter(Boolean) : [t],
        ),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [clientes, setClientes] = useLocalStorageState<Cliente[]>("clientes", clientesMock);
  const [movimentacoes] = useLocalStorageState<MovimentacaoEstoque[]>("movimentacoes", movimentacoesMock);
  const [anotacoes, setAnotacoes] = useLocalStorageState<Anotacao[]>("anotacoes", anotacoesMock);

  const value = useMemo<DataContextValue>(
    () => ({
      fornecedores,
      classificacoes,
      produtos,
      clientes,
      movimentacoes,
      anotacoes,

      addFornecedor: (data) =>
        setFornecedores((prev) => [
          { ...data, id: generateId("forn"), criadoEm: new Date().toISOString() },
          ...prev,
        ]),
      updateFornecedor: (id, data) =>
        setFornecedores((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f))),
      removeFornecedor: (id) => setFornecedores((prev) => prev.filter((f) => f.id !== id)),

      addClassificacao: (data) =>
        setClassificacoes((prev) => [{ ...data, id: generateId("cls") }, ...prev]),
      updateClassificacao: (id, data) =>
        setClassificacoes((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c))),
      removeClassificacao: (id) =>
        setClassificacoes((prev) => prev.filter((c) => c.id !== id)),

      addProduto: (data) =>
        setProdutos((prev) => [{ ...data, id: generateId("prod") }, ...prev]),
      updateProduto: (id, data) =>
        setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p))),
      removeProduto: (id) => setProdutos((prev) => prev.filter((p) => p.id !== id)),

      addCliente: (data) =>
        setClientes((prev) => [
          { ...data, id: generateId("cli"), criadoEm: new Date().toISOString() },
          ...prev,
        ]),
      updateCliente: (id, data) =>
        setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c))),
      removeCliente: (id) => setClientes((prev) => prev.filter((c) => c.id !== id)),

      addAnotacao: (data) =>
        setAnotacoes((prev) => [
          { ...data, id: generateId("anot"), criadoEm: new Date().toISOString() },
          ...prev,
        ]),
      updateAnotacao: (id, data) =>
        setAnotacoes((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a))),
      removeAnotacao: (id) => setAnotacoes((prev) => prev.filter((a) => a.id !== id)),
    }),
    [fornecedores, classificacoes, produtos, clientes, movimentacoes, anotacoes],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData deve ser usado dentro de DataProvider");
  return ctx;
}
