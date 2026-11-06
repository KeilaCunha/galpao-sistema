import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { GuardCadastro } from "./components/auth/GuardCadastro";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./context/AuthContext";
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
      <AuthProvider>
        <AuthGate>
          <DataProvider>
            <PlanilhaProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/configuracoes" element={<Configuracoes />} />
                    <Route
                      path="/fornecedores"
                      element={
                        <GuardCadastro>
                          <Fornecedores />
                        </GuardCadastro>
                      }
                    />
                    <Route
                      path="/produtos"
                      element={
                        <GuardCadastro>
                          <Produtos />
                        </GuardCadastro>
                      }
                    />
                    <Route
                      path="/clientes"
                      element={
                        <GuardCadastro>
                          <Clientes />
                        </GuardCadastro>
                      }
                    />
                    <Route path="/estoque" element={<Estoque />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </PlanilhaProvider>
          </DataProvider>
        </AuthGate>
      </AuthProvider>
    </ToastProvider>
  );
}
