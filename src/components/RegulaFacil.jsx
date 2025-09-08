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
  FileText,
  ClipboardList,
  Newspaper,
  ArrowRightLeft,
} from 'lucide-react';
import { 
  getSetoresCollection, 
  getLeitosCollection,
  getPacientesCollection,
  onSnapshot
} from '@/lib/firebase';
import { cn } from "@/lib/utils";
import GerenciamentoLeitosModal from './GerenciamentoLeitosModal';
import MapaLeitosPanel from './MapaLeitosPanel';
import RegulacaoLeitosPage from './RegulacaoLeitosPage';
import IndicadoresGeraisPanel from './IndicadoresGeraisPanel';
import GestaoIsolamentosPage from './GestaoIsolamentosPage';
import CentralHigienizacaoPage from './CentralHigienizacaoPage';

// Dados de navegação
const navigationItems = [
  { id: "home", label: "Página Inicial", icon: Home },
  { id: "regulacao-leitos", label: "Regulação de Leitos", icon: Bed },
  { id: "mapa-leitos", label: "Mapa de Leitos", icon: Map },
  { id: "central-higienizacao", label: "Central de Higienização", icon: Sparkles },
  { id: "gestao-isolamentos", label: "Gestão de Isolamentos", icon: Shield },
  { id: "marcacao-cirurgica", label: "Marcação Cirúrgica", icon: Calendar },
  { id: "huddle", label: "Huddle", icon: Users },
  { id: "gestao-estrategica", label: "Gestão Estratégica", icon: BarChart3 },
  { id: "auditoria", label: "Auditoria", icon: FileSearch },
  { id: "gestao-usuarios", label: "Gestão de Usuários", icon: UserCog },
  { id: "gestao-pacientes", label: "Gestão de Pacientes", icon: UserCheck },
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

// Componente da página de login
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // Mock login - qualquer email/senha funciona
    onLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-primary rounded-full">
              <Hospital className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              RegulaFacil
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Sistema de Gestão Hospitalar
              <br />
              Hospital Municipal São José
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full mt-6">
              Entrar
            </Button>
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-primary hover:text-primary-hover transition-smooth"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Componente do Header
const Header = ({ currentPage, onToggleSidebar, onLogout }) => {
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
              <span className="hidden sm:inline">Dr. João Silva</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
const Sidebar = ({ isExpanded, currentPage, onNavigate }) => {
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
const HomePage = ({ onNavigate }) => {
  return (
    <div className="space-y-8">
      {/* Welcome Block */}
      <Card className="shadow-card">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">
            Bem-vindo ao RegulaFacil!
          </CardTitle>
          <CardDescription className="text-lg mt-4 max-w-2xl mx-auto">
            Sistema integrado de gestão hospitalar do Hospital Municipal São José. 
            Centralize todas as operações e maximize a eficiência do cuidado ao paciente.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Navigation Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {moduleCards.map((module) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.id}
              className={`card-interactive border-2 ${module.color}`}
              onClick={() => onNavigate(module.id)}
            >
              <CardHeader className="text-center pb-3">
                <div className="flex justify-center mb-3">
                  <div className="p-3 bg-white rounded-full shadow-soft">
                    <Icon className={`h-8 w-8 ${module.iconColor}`} />
                  </div>
                </div>
                <CardTitle className="text-lg font-semibold">
                  {module.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-center text-sm">
                  {module.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activities Block */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Atividades Recentes</CardTitle>
              <CardDescription>
                Acompanhe as últimas atividades do sistema
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Sistema em desenvolvimento</p>
              <p className="text-xs text-muted-foreground">
                Este componente será implementado em breve com o histórico completo de atividades.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Componente da página Mapa de Leitos  
const MapaLeitosPage = () => {
  const [showGerenciamentoModal, setShowGerenciamentoModal] = useState(false);
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [pacientes, setPacientes] = useState([]);

  // Buscar dados do Firestore em tempo real para os indicadores
  useEffect(() => {
    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSetores(setoresData);
    });

    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeitos(leitosData);
    });

    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPacientes(pacientesData);
    });

    return () => {
      unsubscribeSetores();
      unsubscribeLeitos();
      unsubscribePacientes();
    };
  }, []);

  const ferramentas = [
    {
      id: "gerenciamento-leitos",
      title: "Gerenciamento de Leitos",
      icon: Settings2,
      onClick: () => setShowGerenciamentoModal(true),
    },
    {
      id: "relatorio-isolamento",
      title: "Relatório de Isolamento",
      icon: FileText,
    },
    {
      id: "relatorio-leitos-vagos",
      title: "Relatório de Leitos Vagos",
      icon: ClipboardList,
    },
    {
      id: "boletim-diario",
      title: "Boletim diário",
      icon: Newspaper,
    },
    {
      id: "reservas-externas",
      title: "Reservas Externas",
      icon: ArrowRightLeft,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Painel de Indicadores Estratégicos - PRIMEIRO ELEMENTO */}
      <IndicadoresGeraisPanel 
        setores={setores}
        leitos={leitos}
        pacientes={pacientes}
      />

      {/* Linha superior com Ferramentas */}
      <div className="grid grid-cols-1 gap-6">
        {/* Bloco de Ferramentas */}
        <Card className="bg-white rounded-lg shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              Ferramentas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ferramentas.map((ferramenta) => {
              const Icon = ferramenta.icon;
              return (
                <Button
                  key={ferramenta.id}
                  variant="ghost"
                  className="w-full justify-start gap-3 p-4 bg-slate-100 hover:bg-blue-100 rounded-lg"
                  onClick={ferramenta.onClick}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    {ferramenta.title}
                  </span>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Bloco: Painel de Leitos */}
      <Card className="bg-white rounded-lg shadow-md border border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Painel e Mapa de Leitos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MapaLeitosPanel />
        </CardContent>
      </Card>

      {/* Modal de Gerenciamento de Leitos */}
      <GerenciamentoLeitosModal 
        isOpen={showGerenciamentoModal}
        onClose={() => setShowGerenciamentoModal(false)}
      />
    </div>
  );
};

// Componente das páginas em desenvolvimento
const DevelopmentPage = ({ title, description }) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md shadow-card text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Construction className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold">
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-base mt-2">
                {description}
              </CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Em Desenvolvimento</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Funcionalidades disponíveis em breve
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Atualizações em andamento</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Componente principal da aplicação
const RegulaFacil = () => {
  // Estados de controle
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState("home");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Sincroniza estado com a URL (simulação de rotas)
  useEffect(() => {
    const path = window.location.pathname;
    const page = pageFromPath(path);
    if (page === "login") {
      setIsAuthenticated(false);
      setCurrentPage("home");
    } else {
      setIsAuthenticated(true);
      setCurrentPage(page);
    }

    const onPopState = () => {
      const p = window.location.pathname;
      const pg = pageFromPath(p);
      if (pg === "login") {
        setIsAuthenticated(false);
        setCurrentPage("home");
      } else {
        setIsAuthenticated(true);
        setCurrentPage(pg);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Funções de controle
  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentPage("home");
    window.history.pushState({}, "", "/");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage("home");
    window.history.pushState({}, "", "/login");
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
    window.history.pushState({}, "", pathFromPage(page));
  };

  const handleToggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  // Função para renderizar o conteúdo da página atual
  const renderPageContent = () => {
    switch (currentPage) {
      case "home":
        return <HomePage onNavigate={handleNavigate} />;
      case "regulacao-leitos":
        return <RegulacaoLeitosPage />;
      case "mapa-leitos":
        return <MapaLeitosPage />;
      case "central-higienizacao":
        return <CentralHigienizacaoPage />;
      case "gestao-isolamentos":
        return <GestaoIsolamentosPage />;
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
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  // Renderização condicional baseada no estado de autenticação
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        currentPage={getPageTitle(currentPage)}
        onToggleSidebar={handleToggleSidebar}
        onLogout={handleLogout}
      />
      <Sidebar
        isExpanded={sidebarExpanded}
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />
      <main
        className={cn(
          "pt-16 pb-16 transition-all duration-300",
          sidebarExpanded ? "ml-64" : "ml-16"
        )}
      >
        <div className="p-6">
          {renderPageContent()}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RegulaFacil;