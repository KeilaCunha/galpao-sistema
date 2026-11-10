import { Package, Truck, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { StatCard } from "../ui/StatCard";

export function CadastroContadores() {
  const { fornecedores, produtos, clientes } = useData();
  const { pathname } = useLocation();

  const itens = [
    { to: "/fornecedores", label: "Fornecedores", value: fornecedores.length, icon: Truck },
    { to: "/produtos", label: "Produtos", value: produtos.length, icon: Package },
    { to: "/clientes", label: "Clientes", value: clientes.length, icon: Users },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {itens.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={
            pathname === item.to
              ? "rounded-2xl ring-2 ring-brand-400 ring-offset-2 ring-offset-neutral-100"
              : "rounded-2xl"
          }
        >
          <StatCard label={item.label} value={item.value} icon={item.icon} />
        </Link>
      ))}
    </div>
  );
}
