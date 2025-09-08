import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const Layout = ({
  children,
  currentPage,
  sidebarExpanded,
  onToggleSidebar,
  onNavigate,
  onLogout,
}: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Header
        currentPage={getPageTitle(currentPage)}
        onToggleSidebar={onToggleSidebar}
        onLogout={onLogout}
      />
      <Sidebar
        isExpanded={sidebarExpanded}
        currentPage={currentPage}
        onNavigate={onNavigate}
      />
      <main
        className={cn(
          "pt-16 pb-16 transition-all duration-300",
          sidebarExpanded ? "ml-64" : "ml-16"
        )}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

const getPageTitle = (pageId: string): string => {
  const titles: Record<string, string> = {
    home: "Página Inicial",
    "regulacao-leitos": "Regulação de Leitos",
    "mapa-leitos": "Mapa de Leitos",
    "central-higienizacao": "Central de Higienização",
    "gestao-isolamentos": "Gestão de Isolamentos",
    "marcacao-cirurgica": "Marcação Cirúrgica",
    huddle: "Huddle",
    "gestao-estrategica": "Gestão Estratégica",
    auditoria: "Auditoria",
    "gestao-usuarios": "Gestão de Usuários",
    "gestao-pacientes": "Gestão de Pacientes",
  };
  return titles[pageId] || "RegulaFacil";
};

export default Layout;