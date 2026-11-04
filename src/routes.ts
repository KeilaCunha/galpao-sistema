export interface RouteInfo {
  path: string;
  title: string;
  subtitle: string;
}

export const ROUTES: RouteInfo[] = [
  { path: "/", title: "Início", subtitle: "Visão geral do galpão" },
  { path: "/fornecedores", title: "Fornecedores", subtitle: "Gerencie os fornecedores cadastrados" },
  { path: "/produtos", title: "Produtos", subtitle: "Gerencie os produtos comercializados" },
  { path: "/classificacoes", title: "Classificações", subtitle: "Gerencie as classificações de produtos" },
  { path: "/clientes", title: "Clientes", subtitle: "Gerencie os clientes do galpão" },
  { path: "/estoque", title: "Estoque", subtitle: "Controle visual do estoque" },
  { path: "/anotacoes", title: "Anotações", subtitle: "Registros diários de fornecedores e produtos" },
];

export function getRouteInfo(pathname: string): RouteInfo {
  return (
    ROUTES.find((r) => r.path === pathname) ?? {
      path: pathname,
      title: "Galpão",
      subtitle: "",
    }
  );
}
