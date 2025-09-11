import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Hospital,
  Mail,
  Lock,
  Menu,
  User,
  LogOut,
  Home,
  Bed,
  Map,
  Sparkles,
  Shield,
  Calendar,
  Users,
  BarChart3,
  FileSearch,
  UserCog,
  UserCheck,
  Activity,
  Clock,
  Construction,
  Wrench,
  Settings2,
  History,
  CalendarDays,
  FileText,
  ClipboardList,
  Newspaper,
  ArrowRightLeft,
} from 'lucide-react';
import { 
  getSetoresCollection, 
  getLeitosCollection,
  getPacientesCollection,
  getAuditoriaCollection,
  onSnapshot,
  query,
  orderBy,
  limit
} from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import ProtectedRoute from './ProtectedRoute';

// Import existing components
import GerenciamentoLeitosModal from './GerenciamentoLeitosModal';
import MapaLeitosPage from './MapaLeitosPage';
import RegulacaoLeitosPage from './RegulacaoLeitosPage';
import IndicadoresGeraisPanel from './IndicadoresGeraisPanel';
import GestaoIsolamentosPage from './GestaoIsolamentosPage';
import CentralHigienizacaoPage from './CentralHigienizacaoPage';
import GestaoUsuariosPage from './GestaoUsuariosPage';
import GestaoEstrategicaPage from '../pages/GestaoEstrategicaPage';

// Dados de navegação
const navigationItems = [
  { id: "home", label: "Página Inicial", icon: Home, route: "/" },
  { id: "regulacao-leitos", label: "Regulação de Leitos", icon: Bed, route: "/regulacao-leitos" },
  { id: "mapa-leitos", label: "Mapa de Leitos", icon: Map, route: "/mapa-leitos" },
  { id: "central-higienizacao", label: "Central de Higienização", icon: Sparkles, route: "/central-higienizacao" },
  { id: "gestao-isolamentos", label: "Gestão de Isolamentos", icon: Shield, route: "/gestao-isolamentos" },
  { id: "marcacao-cirurgica", label: "Marcação Cirúrgica", icon: Calendar, route: "/marcacao-cirurgica" },
  { id: "huddle", label: "Huddle", icon: Users, route: "/huddle" },
  { id: "gestao-estrategica", label: "Gestão Estratégica", icon: BarChart3, route: "/gestao-estrategica" },
  { id: "auditoria", label: "Auditoria", icon: FileSearch, route: "/auditoria" },
  { id: "gestao-usuarios", label: "Gestão de Usuários", icon: UserCog, route: "/gestao-usuarios" },
  { id: "gestao-pacientes", label: "Gestão de Pacientes", icon: UserCheck, route: "/gestao-pacientes" },
];

// Dados dos módulos para a página inicial
const moduleCards = [
  {
    id: "regulacao-leitos",
    title: "Regulação de Leitos",
    description: "Gestão e controle de ocupação hospitalar",
    icon: Bed,
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    id: "mapa-leitos",
    title: "Mapa de Leitos",
    description: "Visualização em tempo real dos leitos",
    icon: Map,
    color: "bg-green-50 border-green-200 hover:bg-green-100",
    iconColor: "text-green-600",
  },
  {
    id: "central-higienizacao",
    title: "Central de Higienização",
    description: "Controle de limpeza e desinfecção",
    icon: Sparkles,
    color: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    id: "gestao-isolamentos",
    title: "Gestão de Isolamentos",
    description: "Monitoramento de pacientes em isolamento",
    icon: Shield,
    color: "bg-red-50 border-red-200 hover:bg-red-100",
    iconColor: "text-red-600",
  },
  {
    id: "marcacao-cirurgica",
    title: "Marcação Cirúrgica",
    description: "Agendamento e controle de cirurgias",
    icon: Calendar,
    color: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    id: "huddle",
    title: "Huddle",
    description: "Reuniões e discussões multidisciplinares",
    icon: Users,
    color: "bg-teal-50 border-teal-200 hover:bg-teal-100",
    iconColor: "text-teal-600",
  },
  {
    id: "gestao-estrategica",
    title: "Gestão Estratégica",
    description: "Indicadores e análises estratégicas",
    icon: BarChart3,
    color: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100",
    iconColor: "text-indigo-600",
  },
  {
    id: "auditoria",
    title: "Auditoria",
    description: "Análise e controle de qualidade",
    icon: FileSearch,
    color: "bg-gray-50 border-gray-200 hover:bg-gray-100",
    iconColor: "text-gray-600",
  },
  {
    id: "gestao-usuarios",
    title: "Gestão de Usuários",
    description: "Administração de usuários do sistema",
    icon: UserCog,
    color: "bg-pink-50 border-pink-200 hover:bg-pink-100",
    iconColor: "text-pink-600",
  },
  {
    id: "gestao-pacientes",
    title: "Gestão de Pacientes",
    description: "Cadastro e acompanhamento de pacientes",
    icon: UserCheck,
    color: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
    iconColor: "text-yellow-600",
  },
];

// Função para obter o título da página
const getPageTitle = (pageId) => {
  const titles = {
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

// Helpers de mapeamento entre caminho e página
const pageFromPath = (path) => {
  const clean = path.replace(/\/$/, "");
  if (!clean || clean === "") return "home";
  if (clean === "/") return "home";
  if (clean === "/login") return "login";
  const id = clean.startsWith("/") ? clean.slice(1) : clean;
  return navigationItems.some((i) => i.id === id) ? id : "home";
};

const pathFromPage = (page) => {
  if (page === "home") return "/";
  return `/${page}`;
};

// Componente do Header
const Header = ({ currentPage, onToggleSidebar, onLogout, currentUser }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-header-bg border-b border-header-border">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left - Hamburger Menu */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="hover:bg-nav-hover"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Center - Page Title */}
        <h1 className="text-lg font-semibold text-foreground">
          {currentPage}
        </h1>

        {/* Right - User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 hover:bg-nav-hover">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">
                {currentUser?.nomeCompleto || 'Usuário'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-sm">
              <div className="font-medium">{currentUser?.nomeCompleto}</div>
              <div className="text-muted-foreground">{currentUser?.emailInstitucional}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {currentUser?.tipoUsuario}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

// Componente do Sidebar
const Sidebar = ({ isExpanded, currentPage, onNavigate, currentUser }) => {
  const { hasPermission } = useAuth();

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-sidebar border-r border-sidebar-border transition-all duration-300 z-40",
        isExpanded ? "w-64" : "w-16"
      )}
    >
      <nav className="p-2 space-y-1">
        <TooltipProvider>
          {navigationItems.map((item) => {
            const isActive = currentPage === item.id;
            const Icon = item.icon;
            const hasAccess = hasPermission(item.route);

            // Não mostrar itens sem permissão
            if (!hasAccess) return null;

            return (
              <Tooltip key={item.id} delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      "w-full justify-start gap-3 h-12 transition-smooth",
                      isActive
                        ? "bg-nav-active text-primary-foreground"
                        : "hover:bg-nav-hover text-sidebar-foreground",
                      !isExpanded && "justify-center px-0"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {isExpanded && (
                      <span className="text-sm font-medium truncate">
                        {item.label}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" className="ml-2">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </nav>
    </aside>
  );
};

// Componente do Footer
const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-header-bg border-t border-header-border py-3 px-4 z-30">
      <div className="text-center text-sm text-muted-foreground">
        © {currentYear} Hospital Municipal São José. Todos os direitos reservados.
      </div>
    </footer>
  );
};

// Componente da página inicial
const HomePage = ({ onNavigate, currentUser }) => {
  const [atividadesRecentes, setAtividadesRecentes] = useState([]);
  const { hasPermission } = useAuth();

  // Buscar atividades recentes do Firestore
  useEffect(() => {
    const auditoriaQuery = query(
      getAuditoriaCollection(),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(auditoriaQuery, (snapshot) => {
      const atividades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAtividadesRecentes(atividades);
    });

    return () => unsubscribe();
  }, []);

  // Função para formatar tempo relativo
  const formatarTempoRelativo = (timestamp) => {
    if (!timestamp) return 'Agora';
    
    let data;
    if (typeof timestamp.toDate === 'function') {
      data = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      data = timestamp;
    } else {
      data = new Date(timestamp);
    }

    const agora = new Date();
    const diffMinutos = Math.floor((agora - data) / (1000 * 60));

    if (diffMinutos < 1) return 'Agora mesmo';
    if (diffMinutos < 60) return `há ${diffMinutos} minuto${diffMinutos > 1 ? 's' : ''}`;
    
    const diffHoras = Math.floor(diffMinutos / 60);
    if (diffHoras < 24) return `há ${diffHoras} hora${diffHoras > 1 ? 's' : ''}`;
    
    const diffDias = Math.floor(diffHoras / 24);
    if (diffDias < 7) return `há ${diffDias} dia${diffDias > 1 ? 's' : ''}`;
    
    return format(data, 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR });
  };

  // Data atual formatada
  const dataAtual = format(new Date(), 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: ptBR });

  // Filtrar módulos baseado nas permissões
  const availableModules = moduleCards.filter(module => {
    const navItem = navigationItems.find(nav => nav.id === module.id);
    return navItem && hasPermission(navItem.route);
  });

  return (
    <div className="space-y-8">
      {/* Welcome Block - Refinado */}
      <Card className="shadow-card border-0 bg-gradient-subtle">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-3xl font-bold text-foreground mb-2">
            Bem-vindo(a), {currentUser?.nomeCompleto}!
          </CardTitle>
          <CardDescription className="text-lg max-w-2xl mx-auto mb-4 text-muted-foreground">
            Aqui você tem uma visão centralizada para otimizar o fluxo de pacientes e a gestão de leitos do hospital.
          </CardDescription>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="capitalize">{dataAtual}</span>
          </div>
        </CardHeader>
      </Card>

      {/* Navigation Cards Grid - Redesenhados */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-6">Módulos Disponíveis</h2>
        {availableModules.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {availableModules.map((module) => {
              const Icon = module.icon;
              return (
                <Card
                  key={module.id}
                  className="card-interactive border hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
                  onClick={() => onNavigate(module.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-slate-100 rounded-full">
                        <Icon className="h-5 w-5 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm mb-1 truncate">
                          {module.title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {module.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <CardContent>
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Você não possui permissões para acessar nenhum módulo. 
                Entre em contato com um administrador.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Atividades Recentes */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Atividades Recentes
        </h2>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <ul className="divide-y divide-border">
              {atividadesRecentes.map((atividade) => (
                <li key={atividade.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {atividade.acao}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {atividade.pagina} - {formatarTempoRelativo(atividade.timestamp)}
                      </p>
                    </div>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Componente Principal Interno (após autenticação)
const RegulaFacilApp = () => {
  const [currentPage, setCurrentPage] = useState("home");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  
  const { currentUser, logout } = useAuth();
  
  // Hook para logout por inatividade
  useInactivityTimer();


  // Navegação entre páginas
  const handleNavigate = (pageId) => {
    setCurrentPage(pageId);
    const newUrl = pathFromPage(pageId);
    window.history.pushState({ page: pageId }, "", newUrl);
  };

  // Gerenciar navegação do browser
  useEffect(() => {
    const initialPage = pageFromPath(window.location.pathname);
    setCurrentPage(initialPage);

    const handlePopState = (event) => {
      const page = event.state?.page || pageFromPath(window.location.pathname);
      setCurrentPage(page);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Renderizar conteúdo da página
  const renderPageContent = () => {
    const pageRoute = pathFromPage(currentPage);
    
    return (
      <ProtectedRoute requiredRoute={pageRoute}>
        {(() => {
          switch (currentPage) {
            case "home":
              return <HomePage onNavigate={handleNavigate} currentUser={currentUser} />;
            case "regulacao-leitos":
              return <RegulacaoLeitosPage />;
            case "mapa-leitos":
              return <MapaLeitosPage />;
            case "central-higienizacao":
              return <CentralHigienizacaoPage />;
            case "gestao-isolamentos":
              return <GestaoIsolamentosPage />;
            case "gestao-usuarios":
              return <GestaoUsuariosPage />;
            case "marcacao-cirurgica":
              return (
                <div className="p-8 text-center">
                  <Construction className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Marcação Cirúrgica
                  </h2>
                  <p className="text-muted-foreground">
                    Este módulo está em desenvolvimento.
                  </p>
                </div>
              );
            case "huddle":
              return (
                <div className="p-8 text-center">
                  <Construction className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Huddle
                  </h2>
                  <p className="text-muted-foreground">
                    Este módulo está em desenvolvimento.
                  </p>
                </div>
              );
            case "gestao-estrategica":
              return <GestaoEstrategicaPage />;
            case "auditoria":
              return (
                <div className="p-8 text-center">
                  <Construction className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Auditoria
                  </h2>
                  <p className="text-muted-foreground">
                    Este módulo está em desenvolvimento.
                  </p>
                </div>
              );
            case "gestao-pacientes":
              return (
                <div className="p-8 text-center">
                  <Construction className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Gestão de Pacientes
                  </h2>
                  <p className="text-muted-foreground">
                    Este módulo está em desenvolvimento.
                  </p>
                </div>
              );
            default:
              return <HomePage onNavigate={handleNavigate} currentUser={currentUser} />;
          }
        })()}
      </ProtectedRoute>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-subtle">
        <Header 
          currentPage={getPageTitle(currentPage)}
          onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={logout}
          currentUser={currentUser}
        />
        
        <Sidebar
          isExpanded={sidebarExpanded}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          currentUser={currentUser}
        />

        <main
          className={cn(
            "transition-all duration-300",
            "pt-16 pb-16",
            sidebarExpanded ? "ml-64" : "ml-16"
          )}
        >
          <div className="p-6">
            {renderPageContent()}
          </div>
        </main>

        <Footer />
      </div>

    </>
  );
};

export default RegulaFacilApp;
