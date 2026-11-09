import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, apiRemota, checarBanco } from "../api/http";
import { limparPendente, marcarPendente, ouvirSync } from "../api/sync";
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
import { loadFromStorage, removeFromStorage, saveToStorage, useLocalStorageState } from "../utils/storage";

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
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(() => {
    if (apiRemota) {
      removeFromStorage("fornecedores", "produtos", "clientes");
      return [];
    }
    return loadFromStorage("fornecedores", fornecedoresMock);
  });
  const [produtos, setProdutos] = useState<Produto[]>(() =>
    apiRemota ? [] : loadFromStorage("produtos", produtosMock),
  );
  const [clientes, setClientes] = useState<Cliente[]>(() =>
    apiRemota ? [] : loadFromStorage("clientes", clientesMock),
  );
  const [classificacoes, setClassificacoes] = useLocalStorageState<Classificacao[]>(
    "classificacoes",
    classificacoesMock,
  );
  const [movimentacoes] = useLocalStorageState<MovimentacaoEstoque[]>("movimentacoes", movimentacoesMock);
  const [anotacoes, setAnotacoes] = useLocalStorageState<Anotacao[]>("anotacoes", anotacoesMock);
  const bancoRef = useRef(false);
  const [usandoBanco, setUsandoBanco] = useState(false);

  useEffect(() => {
    const precisaNormalizar = produtos.some((p) => (p.tipos ?? []).some((t) => t.includes(",")));
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

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const ok = await checarBanco();
      if (!ok || cancelado) return;
      try {
        const [fornApi, prodApi, cliApi] = await Promise.all([
          api.get<Fornecedor[]>("/fornecedores"),
          api.get<Produto[]>("/produtos"),
          api.get<Cliente[]>("/clientes"),
        ]);
        if (cancelado) return;
        bancoRef.current = true;
        setFornecedores(fornApi);
        setProdutos(prodApi);
        setClientes(cliApi);
        if (!cancelado) setUsandoBanco(true);
      } catch {
        bancoRef.current = false;
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!usandoBanco) return;
    return ouvirSync((pacote) => {
      setFornecedores(pacote.fornecedores);
      setProdutos(pacote.produtos);
      setClientes(pacote.clientes);
    });
  }, [usandoBanco]);

  useEffect(() => {
    if (apiRemota || bancoRef.current) return;
    saveToStorage("fornecedores", fornecedores);
  }, [fornecedores]);
  useEffect(() => {
    if (apiRemota || bancoRef.current) return;
    saveToStorage("produtos", produtos);
  }, [produtos]);
  useEffect(() => {
    if (apiRemota || bancoRef.current) return;
    saveToStorage("clientes", clientes);
  }, [clientes]);

  function salvarCadastro(caminho: string, id: string, body: unknown) {
    if (!bancoRef.current) return;
    marcarPendente(id);
    void api.put(`/${caminho}/${id}`, body).finally(() => limparPendente(id));
  }

  function apagarCadastro(caminho: string, id: string) {
    if (!bancoRef.current) return;
    marcarPendente(id);
    void api.delete(`/${caminho}/${id}`).finally(() => limparPendente(id));
  }

  const value = useMemo<DataContextValue>(
    () => ({
      fornecedores,
      classificacoes,
      produtos,
      clientes,
      movimentacoes,
      anotacoes,

      addFornecedor: (data) => {
        const item: Fornecedor = { ...data, id: generateId("forn"), criadoEm: new Date().toISOString() };
        setFornecedores((prev) => [item, ...prev]);
        salvarCadastro("fornecedores", item.id, item);
      },
      updateFornecedor: (id, data) => {
        setFornecedores((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f)));
        const atual = fornecedores.find((f) => f.id === id);
        salvarCadastro("fornecedores", id, { ...atual, ...data, id });
      },
      removeFornecedor: (id) => {
        setFornecedores((prev) => prev.filter((f) => f.id !== id));
        apagarCadastro("fornecedores", id);
      },

      addClassificacao: (data) =>
        setClassificacoes((prev) => [{ ...data, id: generateId("cls") }, ...prev]),
      updateClassificacao: (id, data) =>
        setClassificacoes((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c))),
      removeClassificacao: (id) =>
        setClassificacoes((prev) => prev.filter((c) => c.id !== id)),

      addProduto: (data) => {
        const item: Produto = { ...data, id: generateId("prod") };
        setProdutos((prev) => [item, ...prev]);
        salvarCadastro("produtos", item.id, item);
      },
      updateProduto: (id, data) => {
        setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
        const atual = produtos.find((p) => p.id === id);
        salvarCadastro("produtos", id, { ...atual, ...data, id });
      },
      removeProduto: (id) => {
        setProdutos((prev) => prev.filter((p) => p.id !== id));
        apagarCadastro("produtos", id);
      },

      addCliente: (data) => {
        const item: Cliente = { ...data, id: generateId("cli"), criadoEm: new Date().toISOString() };
        setClientes((prev) => [item, ...prev]);
        salvarCadastro("clientes", item.id, item);
      },
      updateCliente: (id, data) => {
        setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
        const atual = clientes.find((c) => c.id === id);
        salvarCadastro("clientes", id, { ...atual, ...data, id });
      },
      removeCliente: (id) => {
        setClientes((prev) => prev.filter((c) => c.id !== id));
        apagarCadastro("clientes", id);
      },

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
