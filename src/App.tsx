import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Login from "./pages/Login";
import Home from "./pages/Home";
import DevelopmentPage from "./pages/DevelopmentPage";
import Layout from "./components/layout/Layout";

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState("home");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage("home");
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const handleToggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home onNavigate={handleNavigate} />;
      case "regulacao-leitos":
        return (
          <DevelopmentPage
            title="Regulação de Leitos"
            description="Gestão e controle de ocupação hospitalar"
          />
        );
      case "mapa-leitos":
        return (
          <DevelopmentPage
            title="Mapa de Leitos"
            description="Visualização em tempo real dos leitos"
          />
        );
      case "central-higienizacao":
        return (
          <DevelopmentPage
            title="Central de Higienização"
            description="Controle de limpeza e desinfecção"
          />
        );
      case "gestao-isolamentos":
        return (
          <DevelopmentPage
            title="Gestão de Isolamentos"
            description="Monitoramento de pacientes em isolamento"
          />
        );
      case "marcacao-cirurgica":
        return (
          <DevelopmentPage
            title="Marcação Cirúrgica"
            description="Agendamento e controle de cirurgias"
          />
        );
      case "huddle":
        return (
          <DevelopmentPage
            title="Huddle"
            description="Reuniões e discussões multidisciplinares"
          />
        );
      case "gestao-estrategica":
        return (
          <DevelopmentPage
            title="Gestão Estratégica"
            description="Indicadores e análises estratégicas"
          />
        );
      case "auditoria":
        return (
          <DevelopmentPage
            title="Auditoria"
            description="Análise e controle de qualidade"
          />
        );
      case "gestao-usuarios":
        return (
          <DevelopmentPage
            title="Gestão de Usuários"
            description="Administração de usuários do sistema"
          />
        );
      case "gestao-pacientes":
        return (
          <DevelopmentPage
            title="Gestão de Pacientes"
            description="Cadastro e acompanhamento de pacientes"
          />
        );
      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Login onLogin={handleLogin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Layout
          currentPage={currentPage}
          sidebarExpanded={sidebarExpanded}
          onToggleSidebar={handleToggleSidebar}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        >
          {renderPage()}
        </Layout>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
