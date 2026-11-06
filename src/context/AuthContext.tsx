import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { aoSessaoExpirar, api, apiRemota, definirToken, guardarLiberacao, tokenAtual } from "../api/http";
import type { CampoTrava, ChaveColunaFolha, Permissoes, Travas, Usuario, VisibilidadeFolha } from "../utils/permissoes";
import {
  ehResponsavel,
  mesclarColunasFolha,
  PERMISSOES_TODAS,
  pode as podeFazer,
  podeVerColuna,
  TRAVAS_PADRAO,
} from "../utils/permissoes";

type FaseAuth = "carregando" | "livre" | "login" | "logado";

interface RespostaSessao {
  usuario: Usuario & { token?: string };
  travas: Travas;
}

interface AuthContextValue {
  fase: FaseAuth;
  usuario: Usuario | null;
  travas: Travas;
  modoLivre: boolean;
  precisaSetup: boolean;
  ehResponsavel: boolean;
  pode: (chave: keyof Permissoes) => boolean;
  verColuna: (chave: ChaveColunaFolha) => boolean;
  estaLiberado: (entradaId: string, campo: CampoTrava) => boolean;
  login: (nome: string, pin: string) => Promise<void>;
  setup: (nome: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  autorizar: (opts: { nome: string; pin: string; entradaId: string; campos: CampoTrava[] }) => Promise<string>;
  recarregar: () => Promise<void>;
  encerrarLiberacao: (entradaId: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<FaseAuth>("carregando");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [travas, setTravas] = useState<Travas>(TRAVAS_PADRAO);
  const [precisaSetup, setPrecisaSetup] = useState(false);
  const [liberados, setLiberados] = useState<Record<string, CampoTrava[]>>({});

  const aplicarSessao = useCallback((dados: RespostaSessao) => {
    const token = dados.usuario.token ?? tokenAtual();
    definirToken(token);
    const { token: _t, ...pessoa } = dados.usuario;
    setUsuario(pessoa);
    setTravas({ ...TRAVAS_PADRAO, ...dados.travas });
    setPrecisaSetup(false);
    setFase("logado");
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const estado = await api.get<{ db: boolean; configurado: boolean }>("/auth/estado");
      if (!estado.db) {
        definirToken("");
        setUsuario(null);
        setPrecisaSetup(false);
        setFase(apiRemota ? "login" : "livre");
        return;
      }
      if (!estado.configurado) {
        definirToken("");
        setUsuario(null);
        setPrecisaSetup(true);
        setFase("login");
        return;
      }
      setPrecisaSetup(false);
      if (!tokenAtual()) {
        setUsuario(null);
        setFase("login");
        return;
      }
      try {
        const eu = await api.get<RespostaSessao>("/auth/eu");
        setUsuario(eu.usuario);
        setTravas({ ...TRAVAS_PADRAO, ...eu.travas });
        setFase("logado");
      } catch {
        definirToken("");
        setUsuario(null);
        setFase("login");
      }
    } catch {
      definirToken("");
      setUsuario(null);
      setPrecisaSetup(false);
      setFase(apiRemota ? "login" : "livre");
    }
  }, []);

  useEffect(() => {
    void recarregar();
    aoSessaoExpirar(() => {
      setUsuario(null);
      setFase("login");
    });
    return () => aoSessaoExpirar(null);
  }, [recarregar]);

  const login = useCallback(
    async (nome: string, pin: string) => {
      const dados = await api.post<RespostaSessao>("/auth/login", { nome, pin });
      aplicarSessao(dados);
    },
    [aplicarSessao],
  );

  const setup = useCallback(
    async (nome: string, pin: string) => {
      const dados = await api.post<RespostaSessao>("/auth/setup", { nome, pin });
      aplicarSessao(dados);
    },
    [aplicarSessao],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* sessão já inválida */
    }
    definirToken("");
    setUsuario(null);
    setLiberados({});
    setFase("login");
  }, []);

  const autorizar = useCallback(
    async ({ nome, pin, entradaId, campos }: { nome: string; pin: string; entradaId: string; campos: CampoTrava[] }) => {
      const resp = await api.post<{ token: string; campos: CampoTrava[]; autorizadoPor: Usuario }>(
        "/auth/autorizar",
        { nome, pin, entradaId, campos },
      );
      guardarLiberacao(entradaId, resp.token);
      setLiberados((prev) => ({
        ...prev,
        [entradaId]: [...new Set([...(prev[entradaId] ?? []), ...resp.campos])],
      }));
      return resp.autorizadoPor.nome;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      fase,
      usuario,
      travas,
      modoLivre: fase === "livre",
      precisaSetup,
      ehResponsavel: ehResponsavel(usuario),
      pode: (chave) => podeFazer(usuario, chave, fase === "livre"),
      verColuna: (chave) => podeVerColuna(usuario, chave, fase === "livre"),
      estaLiberado: (entradaId, campo) => (liberados[entradaId] ?? []).includes(campo),
      login,
      setup,
      logout,
      autorizar,
      recarregar,
      encerrarLiberacao: (entradaId) => {
        setLiberados((prev) => {
          const { [entradaId]: _ok, ...resto } = prev;
          return resto;
        });
      },
    }),
    [fase, usuario, travas, precisaSetup, liberados, login, setup, logout, autorizar, recarregar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export function permissoesIniciais(papel: Usuario["papel"]): Permissoes {
  if (papel === "responsavel") return { ...PERMISSOES_TODAS };
  return {
    folha: true,
    destinos: true,
    sobras: true,
    porCliente: false,
    relatorios: false,
    cadastros: false,
  };
}

export function visibilidadeIniciais(papel: Usuario["papel"]): VisibilidadeFolha {
  return mesclarColunasFolha(papel);
}
