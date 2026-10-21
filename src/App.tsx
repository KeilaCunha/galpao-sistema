import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DataProvider } from "./context/DataContext";
import { PlanilhaProvider } from "./context/PlanilhaContext";
import { ToastProvider } from "./context/ToastContext";
import Clientes from "./pages/Clientes";
import Configuracoes from "./pages/Configuracoes";
import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import Fornecedores from "./pages/Fornecedores";
import Produtos from "./pages/Produtos";

export default function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <PlanilhaProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/fornecedores" element={<Fornecedores />} />
                <Route path="/produtos" element={<Produtos />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PlanilhaProvider>
      </DataProvider>
    </ToastProvider>
  );
}
