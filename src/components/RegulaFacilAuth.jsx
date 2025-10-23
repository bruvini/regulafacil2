import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Hospital,
  Mail,
  Lock,
  Menu,
  User,
  LogOut,
  PanelLeft,
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
  Info,
  X,
} from 'lucide-react';
import {
  getSetoresCollection,
  getLeitosCollection,
  getPacientesCollection,
  getAuditoriaCollection,
  getInfeccoesCollection,
  getReservasExternasCollection,
  getHistoricoRegulacoesCollection,
  onSnapshot,
  query,
  orderBy,
  limit
} from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import { toast } from '@/components/ui/use-toast';

// Import existing components
import GerenciamentoLeitosModal from './GerenciamentoLeitosModal';
import MapaLeitosPage from './MapaLeitosPage';
import RegulacaoLeitosPage from './RegulacaoLeitosPage';
import IndicadoresGeraisPanel from './IndicadoresGeraisPanel';
import GestaoIsolamentosPage from './GestaoIsolamentosPage';
import CentralHigienizacaoPage from './CentralHigienizacaoPage';
import GestaoUsuariosPage from './GestaoUsuariosPage';
import GestaoEstrategicaPage from '../pages/GestaoEstrategicaPage';
import AuditoriaPage from '../pages/AuditoriaPage';
import GestaoPacientesPage from './GestaoPacientesPage';
import InformacoesPage from '../pages/InformacoesPage';

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
  { id: "informacoes", label: "Informações", icon: Info, route: "/informacoes" },
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

const REGULACAO_ACTIONS = [
  'Regulação Iniciada',
  'Regulação Concluída',
  'Regulação Alterada',
  'Regulação Cancelada',
];

const REGULACAO_KEYWORDS = [
  'regulação iniciada',
  'regulação concluída',
  'regulação alterada',
  'regulação cancelada',
];

const STATUS_LEITO_ACTIONS = [
  'Leito Liberado',
  'Leito Ocupado',
  'Leito Higienização',
  'Sincronização via MV',
];

const STATUS_LEITO_KEYWORDS = [
  'foi liberado',
  'foi bloqueado',
  'status alterado',
  'sincronização via mv',
  'sincronizacao via mv',
  'higienização',
  'higienizacao',
];

const PEDIDOS_ACTIONS = [
  'Pedido UTI Solicitado',
  'Pedido UTI Cancelado',
  'Pedido UTI Atendido',
  'Remanejamento Solicitado',
  'Remanejamento Atendido',
  'Remanejamento Cancelado',
  'Transferência Externa Solicitada',
];

const PEDIDOS_KEYWORDS = [
  'pedido de uti',
  'remanejamento',
  'transferência externa',
  'transferencia externa',
];

const OBSERVACOES_ACTIONS = ['Observação Adicionada'];

const OBSERVACOES_KEYWORDS = ['observação', 'observacao'];

const PROVAVEIS_ALTAS_ACTIONS = ['Provável Alta Adicionada', 'Provável Alta Removida'];

const PROVAVEIS_ALTAS_KEYWORDS = ['provável alta', 'provavel alta'];

const ALTAS_LEITO_ACTIONS = ['Alta no Leito Adicionada', 'Alta no Leito Removida'];

const ALTAS_LEITO_KEYWORDS = ['alta no leito'];

const extractLogMessage = (log) => {
  if (!log) return "";
  const { details } = log;

  if (typeof details === 'string') return details;

  if (Array.isArray(details)) {
    return details
      .map((item) => (typeof item === 'string' ? item : ''))
      .filter(Boolean)
      .join(' ');
  }

  if (details && typeof details === 'object') {
    if (typeof details.texto === 'string') return details.texto;
    if (typeof details.mensagem === 'string') return details.mensagem;
    if (typeof details.message === 'string') return details.message;
    if (typeof details.descricao === 'string') return details.descricao;
    if (typeof details.resumo === 'string') return details.resumo;
  }

  return (
    log.acao ||
    log.mensagem ||
    log.mensagemLog ||
    log.descricao ||
    log.description ||
    log.message ||
    ""
  );
};

const extractLogModule = (log) => {
  if (!log) return "";
  return log.module || log.modulo || log.pagina || log.categoria || log.contexto || log.context || "Sistema";
};

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
    informacoes: "Informações",
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
const Header = ({ currentPage, onToggleSidebar, onOpenMobileSidebar, currentUser, isScrolled }) => {
  return (
    <header
      className={cn(
        "header-main fixed top-0 left-0 right-0 z-50 border-b border-header-border",
        isScrolled && "scrolled"
      )}
    >
      <div className="flex h-16 items-center justify-between px-3 sm:px-4">
        <div className="flex flex-shrink-0 items-center gap-2">
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenMobileSidebar}
              className="hover:bg-nav-hover md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="hidden md:inline-flex hover:bg-nav-hover"
          >
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Alternar sidebar</span>
          </Button>
        </div>

        <h1 className="flex-1 truncate px-2 text-center text-base font-semibold text-foreground sm:text-lg">
          {currentPage}
        </h1>

        <div className="flex flex-shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 py-1.5 hover:bg-nav-hover">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden text-sm font-medium sm:inline">
                  {currentUser?.nomeCompleto || 'Usuário'}
                </span>
                <span className="sr-only sm:hidden">
                  {currentUser?.nomeCompleto || 'Usuário'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm">
                <div className="font-medium">{currentUser?.nomeCompleto}</div>
                <div className="text-muted-foreground">{currentUser?.emailInstitucional}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {currentUser?.tipoUsuario}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Matrícula: {currentUser?.matricula || 'N/A'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Acessos: {currentUser?.qtdAcessos ?? currentUser?.acessos ?? 0}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

const SidebarContent = ({
  isExpanded,
  currentPage,
  onNavigate,
  onRequestLogout,
  onClose,
  enableTooltips = true,
}) => {
  const { hasPermission } = useAuth();
  const showCloseButton = Boolean(onClose);

  const handleNavigate = useCallback(
    (pageId) => {
      onNavigate(pageId);
      if (onClose) {
        onClose();
      }
    },
    [onClose, onNavigate]
  );

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border px-3 py-3 transition-smooth sm:px-4",
          isExpanded ? "justify-between" : "justify-center",
        )}
      >
        <div className={cn("flex items-center", isExpanded ? "gap-3" : "gap-0")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Hospital className="h-5 w-5" />
          </div>
          {isExpanded && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">RegulaFácil</p>
              <p className="text-xs text-muted-foreground">Centro de Controle</p>
            </div>
          )}
        </div>
        {showCloseButton && (
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar menu</span>
            </Button>
          </SheetClose>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3 sm:px-3">
        {navigationItems.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;
          const hasAccess = hasPermission(item.route);

          if (!hasAccess) return null;

          const button = (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => handleNavigate(item.id)}
              className={cn(
                "w-full justify-start gap-3 h-11 rounded-lg text-sm transition-smooth sm:h-12",
                isActive
                  ? "bg-nav-active text-primary-foreground"
                  : "hover:bg-nav-hover text-sidebar-foreground",
                !isExpanded && "justify-center px-0"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" />
              {isExpanded && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </Button>
          );

          if (!enableTooltips || isExpanded) {
            return button;
          }

          return (
            <Tooltip key={item.id} delayDuration={300}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right" className="ml-2">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-2 pb-3 sm:px-3">
        <Button
          variant="ghost"
          onClick={() => {
            onRequestLogout();
            if (onClose) {
              onClose();
            }
          }}
          className={cn(
            "w-full justify-start gap-3 h-11 rounded-lg text-sm font-medium text-destructive hover:bg-nav-hover transition-smooth",
            !isExpanded && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" />
          {isExpanded && <span>Sair</span>}
        </Button>
      </div>
    </div>
  );
};

// Componente do Sidebar
const Sidebar = ({ isExpanded, currentPage, onNavigate }) => {
  const { logout } = useAuth();
  const [alertaLogoutAberto, setAlertaLogoutAberto] = useState(false);

  const handleConfirmarLogout = useCallback(() => {
    setAlertaLogoutAberto(false);
    logout();
  }, [logout]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 md:flex",
        isExpanded ? "w-64" : "w-16"
      )}
    >
      <TooltipProvider>
        <SidebarContent
          isExpanded={isExpanded}
          currentPage={currentPage}
          onNavigate={onNavigate}
          onRequestLogout={() => setAlertaLogoutAberto(true)}
          enableTooltips
        />
      </TooltipProvider>
      <AlertDialog open={alertaLogoutAberto} onOpenChange={setAlertaLogoutAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Saída</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja sair do sistema?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAlertaLogoutAberto(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarLogout}>
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
};

// Componente do Footer
const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-header-border bg-header-bg py-2.5 px-3 sm:px-4">
      <div className="text-center text-xs text-muted-foreground sm:text-sm">
        © {currentYear} Hospital Municipal São José. Todos os direitos reservados.
      </div>
    </footer>
  );
};

// Componente da página inicial
const HomePage = ({ onNavigate, currentUser }) => {
  const [todosLogs, setTodosLogs] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [infeccoes, setInfeccoes] = useState([]);
  const [historicoRegulacoes, setHistoricoRegulacoes] = useState([]);
  const { hasPermission } = useAuth();

  useEffect(() => {
    const unsubscribe = onSnapshot(getInfeccoesCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInfeccoes(lista);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const reservasQuery = query(
      getReservasExternasCollection(),
      orderBy('criadoEm', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(reservasQuery, (snapshot) => {
      const registros = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setReservas(registros);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const historicoQuery = query(
      getHistoricoRegulacoesCollection(),
      orderBy('dataInicio', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(historicoQuery, (snapshot) => {
      const registros = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setHistoricoRegulacoes(registros);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const auditoriaQuery = query(
      getAuditoriaCollection(),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(auditoriaQuery, (snapshot) => {
      const registros = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTodosLogs(registros);
    });

    return () => unsubscribe();
  }, []);

  const normalizar = useCallback((valor) => {
    if (valor === undefined || valor === null) return '';
    return String(valor).toLowerCase();
  }, []);

  const normalizarSemAcento = useCallback(
    (valor) =>
      normalizar(valor)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, ''),
    [normalizar]
  );

  const matchesAction = useCallback(
    (log, actions = [], keywords = []) => {
      const actionSet = actions.map((acao) => normalizar(acao));
      const actionTexto = normalizar(log?.action || log?.acao);

      if (actionTexto && actionSet.includes(actionTexto)) {
        return true;
      }

      if (keywords.length > 0) {
        const mensagem = normalizar(extractLogMessage(log));
        return keywords.some((palavra) => mensagem.includes(normalizar(palavra)));
      }

      return false;
    },
    [normalizar]
  );

  const limitarLogs = useCallback((logs) => logs.slice(0, 10), []);

  const extrairDataEvento = useCallback((item) => {
    if (!item) return null;

    const origemTemporal =
      item.eventTimestamp ||
      item.atualizadoEm ||
      item.timestamp ||
      item.criadoEm ||
      item.data;

    if (!origemTemporal) return null;

    if (typeof origemTemporal.toDate === 'function') {
      return origemTemporal.toDate();
    }

    if (origemTemporal instanceof Date) {
      return origemTemporal;
    }

    const dataConvertida = new Date(origemTemporal);
    return Number.isNaN(dataConvertida.getTime()) ? null : dataConvertida;
  }, []);

  const ordenarPorDataDesc = useCallback(
    (lista) =>
      [...lista].sort((a, b) => {
        const dataA = extrairDataEvento(a);
        const dataB = extrairDataEvento(b);

        const valorA = dataA ? dataA.getTime() : 0;
        const valorB = dataB ? dataB.getTime() : 0;

        return valorB - valorA;
      }),
    [extrairDataEvento]
  );

  const atividadesUnificadas = useMemo(() => {
    const logsAuditoria = todosLogs.map((log) => ({
      ...log,
      type: 'auditoria',
      eventTimestamp: log.eventTimestamp || log.timestamp || null,
    }));

    const logsReservas = reservas.map((reserva) => ({
      ...reserva,
      type: 'reserva',
      eventTimestamp: reserva.atualizadoEm || reserva.criadoEm || null,
    }));

    return [...logsAuditoria, ...logsReservas];
  }, [todosLogs, reservas]);

  const auditoriaEventos = useMemo(
    () => atividadesUnificadas.filter((item) => item.type === 'auditoria'),
    [atividadesUnificadas]
  );

  const reservasEventos = useMemo(
    () => atividadesUnificadas.filter((item) => item.type === 'reserva'),
    [atividadesUnificadas]
  );

  const getDetalhesObjeto = useCallback((log) => {
    if (log?.details && typeof log.details === 'object' && !Array.isArray(log.details)) {
      return log.details;
    }
    return {};
  }, []);

  const getNomeUsuario = useCallback((log) => {
    return log?.userName || log?.usuario || 'Usuário';
  }, []);

  const construirMensagemHistoricoRegulacao = useCallback(
    (registro) => {
      if (!registro) return 'Atualização de regulação registrada.';

      const paciente = registro.pacienteNome || registro.nomePaciente || 'paciente';
      const statusBruto = registro.statusFinal || registro.status || registro.resultado || '';
      const tipoBruto =
        registro.tipo ||
        registro.tipoRegulacao ||
        registro.modalidade ||
        registro.modo ||
        registro.categoria ||
        '';

      const statusNormalizado = normalizar(statusBruto);
      const statusSemAcento = normalizarSemAcento(statusBruto);
      const tipoSemAcento = normalizarSemAcento(tipoBruto);

      if (statusSemAcento === 'concluida') {
        return `Regulação concluída para ${paciente}.`;
      }

      if (statusSemAcento === 'cancelada') {
        const motivo = registro.motivoCancelamento || registro.motivo || registro.justificativa;
        const detalheMotivo = motivo ? ` (motivo: ${motivo})` : '';
        return `Regulação cancelada para ${paciente}${detalheMotivo}.`;
      }

      if (statusSemAcento === 'alterada') {
        return `Regulação alterada para ${paciente}.`;
      }

      if (tipoSemAcento === 'internacao') {
        return `Internação iniciada para ${paciente}.`;
      }

      if (tipoSemAcento === 'transferencia externa') {
        return `Transferência externa iniciada para ${paciente}.`;
      }

      if (tipoSemAcento === 'transferencia interna' || tipoSemAcento === 'remanejamento') {
        return `Regulação iniciada para ${paciente}.`;
      }

      if (statusNormalizado === 'em andamento' || statusSemAcento === 'em andamento' || !statusBruto) {
        return `Regulação iniciada para ${paciente}.`;
      }

      return `Atualização de regulação para ${paciente}.`;
    },
    [normalizar, normalizarSemAcento]
  );

  const regulacaoLogs = useMemo(() => {
    const logs = (historicoRegulacoes || []).map((registro) => {
      const statusBruto = registro.statusFinal || registro.status || registro.resultado || '';
      const statusSemAcento = normalizarSemAcento(statusBruto);

      const dataReferencia =
        registro.dataAtualizacao ||
        registro.dataAtualizadoEm ||
        (statusSemAcento === 'concluida' && registro.dataConclusao) ||
        (statusSemAcento === 'cancelada' && registro.dataCancelamento) ||
        registro.dataInicio;

      return {
        ...registro,
        type: 'regulacao',
        module: 'Regulação de Leitos',
        action: statusBruto || registro.tipo || 'Regulação',
        mensagemFeed: construirMensagemHistoricoRegulacao(registro),
        eventTimestamp: dataReferencia || registro.dataInicio || null,
      };
    });

    return limitarLogs(ordenarPorDataDesc(logs));
  }, [
    historicoRegulacoes,
    construirMensagemHistoricoRegulacao,
    limitarLogs,
    normalizarSemAcento,
    ordenarPorDataDesc,
  ]);

  const isolamentoLogs = useMemo(
    () =>
      limitarLogs(
        auditoriaEventos.filter((log) => matchesAction(log, [], ['isolamento']))
      ),
    [auditoriaEventos, matchesAction, limitarLogs]
  );

  const statusLeitosLogs = useMemo(
    () =>
      limitarLogs(
        auditoriaEventos.filter((log) => matchesAction(log, STATUS_LEITO_ACTIONS, STATUS_LEITO_KEYWORDS))
      ),
    [auditoriaEventos, matchesAction, limitarLogs]
  );

  const higienizacaoLogs = useMemo(
    () =>
      limitarLogs(
        auditoriaEventos.filter((log) => matchesAction(log, [], ['higienização', 'higienizacao']))
      ),
    [auditoriaEventos, matchesAction, limitarLogs]
  );

  const pedidosLogs = useMemo(
    () =>
      limitarLogs(
        auditoriaEventos.filter((log) => matchesAction(log, PEDIDOS_ACTIONS, PEDIDOS_KEYWORDS))
      ),
    [auditoriaEventos, matchesAction, limitarLogs]
  );

  const observacoesLogs = useMemo(
    () =>
      limitarLogs(
        auditoriaEventos.filter((log) => matchesAction(log, OBSERVACOES_ACTIONS, OBSERVACOES_KEYWORDS))
      ),
    [auditoriaEventos, matchesAction, limitarLogs]
  );

  const altasLeitoLogs = useMemo(
    () =>
      limitarLogs(
        auditoriaEventos.filter((log) => matchesAction(log, ALTAS_LEITO_ACTIONS, ALTAS_LEITO_KEYWORDS))
      ),
    [auditoriaEventos, matchesAction, limitarLogs]
  );

  const provaveisAltasLogs = useMemo(
    () =>
      limitarLogs(
        auditoriaEventos.filter((log) => matchesAction(log, PROVAVEIS_ALTAS_ACTIONS, PROVAVEIS_ALTAS_KEYWORDS))
      ),
    [auditoriaEventos, matchesAction, limitarLogs]
  );

  const reservasLogs = useMemo(
    () => limitarLogs(ordenarPorDataDesc(reservasEventos)),
    [reservasEventos, ordenarPorDataDesc, limitarLogs]
  );

  const formatRegulacaoMensagem = useCallback(
    (log) => {
      if (log?.mensagemFeed) {
        return log.mensagemFeed;
      }

      const detalhes = getDetalhesObjeto(log);
      const usuario = getNomeUsuario(log);
      const paciente = detalhes.pacienteNome || detalhes.paciente || '';
      const origem = detalhes.origem || detalhes.origemLeito || detalhes.leitoOrigem || '';
      const destino = detalhes.destino || detalhes.destinoLeito || detalhes.leitoDestino || '';
      const tempo = detalhes.tempoRegulacao || detalhes.tempo || detalhes.duracao;
      const motivo = detalhes.motivo || detalhes.justificativa;

      switch (normalizar(log?.action)) {
        case normalizar('Regulação Iniciada'):
          if (paciente && origem && destino) {
            return `Regulação iniciada por ${usuario} para ${paciente} do leito ${origem} para ${destino}.`;
          }
          break;
        case normalizar('Regulação Concluída'):
          if (paciente && origem && destino) {
            const tempoMensagem = tempo ? ` em ${tempo}.` : '.';
            return `Regulação concluída por ${usuario} para ${paciente} do leito ${origem} para ${destino}${tempoMensagem}`;
          }
          break;
        case normalizar('Regulação Alterada'):
          if (paciente && origem && destino) {
            return `Regulação alterada por ${usuario} para ${paciente}: ${origem} → ${destino}.`;
          }
          break;
        case normalizar('Regulação Cancelada'):
          if (paciente) {
            const base = `Regulação cancelada por ${usuario}${paciente ? ` para ${paciente}` : ''}`;
            return motivo ? `${base}. Motivo: ${motivo}.` : `${base}.`;
          }
          break;
        default:
          break;
      }

      const mensagemFallback = extractLogMessage(log);
      if (mensagemFallback) return mensagemFallback;
      return `${usuario} registrou uma atividade de regulação.`;
    },
    [getDetalhesObjeto, getNomeUsuario, normalizar]
  );

  const formatStatusLeitoMensagem = useCallback(
    (log) => {
      const detalhes = getDetalhesObjeto(log);
      const usuario = getNomeUsuario(log);
      const codigoLeito = detalhes.codigoLeito || detalhes.leito || detalhes.leitoCodigo || '';
      const status = detalhes.novoStatus || detalhes.status || detalhes.statusAtual || '';
      const motivo = detalhes.motivo || detalhes.justificativa;
      const resumo = detalhes.resumo || detalhes.detalhes || '';

      if (normalizar(log?.action) === normalizar('Sincronização via MV')) {
        const textoResumo = resumo || extractLogMessage(log);
        return `Sincronização via MV executada por ${usuario}${textoResumo ? `. ${textoResumo}` : '.'}`;
      }

      if (codigoLeito || status) {
        const baseCodigo = codigoLeito ? `${codigoLeito} ` : 'Leito ';
        const baseStatus = status || log?.action?.replace(/Leito\s+/i, '') || 'novo status';
        const mensagemMotivo = motivo ? `. Motivo: ${motivo}.` : '.';
        return `${baseCodigo}teve seu status alterado para ${baseStatus} por ${usuario}${mensagemMotivo}`;
      }

      const mensagemFallback = extractLogMessage(log);
      if (mensagemFallback) return mensagemFallback;
      return `${usuario} atualizou o status de um leito.`;
    },
    [getDetalhesObjeto, getNomeUsuario, normalizar]
  );

  const formatPedidosMensagem = useCallback(
    (log) => {
      const detalhes = getDetalhesObjeto(log);
      const usuario = getNomeUsuario(log);
      const paciente = detalhes.pacienteNome || detalhes.paciente || '';
      const motivo = detalhes.motivo || detalhes.tipo || detalhes.justificativa;
      const destino = detalhes.destino || detalhes.localDestino || '';

      switch (normalizar(log?.action)) {
        case normalizar('Pedido UTI Solicitado'):
          if (paciente) {
            return `Pedido de UTI para ${paciente} foi solicitado por ${usuario}.`;
          }
          break;
        case normalizar('Pedido UTI Cancelado'):
          if (paciente) {
            return `Pedido de UTI para ${paciente} foi cancelado por ${usuario}${motivo ? `. Motivo: ${motivo}.` : '.'}`;
          }
          break;
        case normalizar('Pedido UTI Atendido'):
          if (paciente) {
            return `Pedido de UTI para ${paciente} foi atendido por ${usuario}.`;
          }
          break;
        case normalizar('Remanejamento Solicitado'):
          if (paciente) {
            return `Remanejamento de ${paciente} foi solicitado por ${usuario}${motivo ? `. Motivo: ${motivo}.` : '.'}`;
          }
          break;
        case normalizar('Remanejamento Atendido'):
          if (paciente) {
            return `Remanejamento de ${paciente} foi atendido por ${usuario}.`;
          }
          break;
        case normalizar('Remanejamento Cancelado'):
          if (paciente) {
            return `Remanejamento de ${paciente} foi cancelado por ${usuario}${motivo ? `. Motivo: ${motivo}.` : '.'}`;
          }
          break;
        case normalizar('Transferência Externa Solicitada'):
          if (paciente) {
            const destinoTexto = destino ? `. Destino: ${destino}.` : '.';
            return `Transferência externa para ${paciente} foi solicitada por ${usuario}${destinoTexto}`;
          }
          break;
        default:
          break;
      }

      const mensagemFallback = extractLogMessage(log);
      if (mensagemFallback) return mensagemFallback;
      return `${usuario} registrou um pedido.`;
    },
    [getDetalhesObjeto, getNomeUsuario, normalizar]
  );

  const formatObservacaoMensagem = useCallback(
    (log) => {
      const detalhes = getDetalhesObjeto(log);
      const usuario = getNomeUsuario(log);
      const paciente = detalhes.pacienteNome || detalhes.paciente || '';
      const texto = detalhes.texto || detalhes.observacao || detalhes.mensagem;

      if (paciente && texto) {
        return `${usuario} adicionou uma observação para ${paciente}: '${texto}'.`;
      }

      const mensagemFallback = extractLogMessage(log);
      if (mensagemFallback) return mensagemFallback;
      return `${usuario} adicionou uma observação.`;
    },
    [getDetalhesObjeto, getNomeUsuario]
  );

  const formatProvavelAltaMensagem = useCallback(
    (log) => {
      const detalhes = getDetalhesObjeto(log);
      const usuario = getNomeUsuario(log);
      const paciente = detalhes.pacienteNome || detalhes.paciente || '';

      switch (normalizar(log?.action)) {
        case normalizar('Provável Alta Adicionada'):
          if (paciente) {
            return `${usuario} adicionou a sinalização de Provável Alta para o paciente ${paciente}.`;
          }
          break;
        case normalizar('Provável Alta Removida'):
          if (paciente) {
            return `${usuario} removeu a sinalização de Provável Alta para o paciente ${paciente}.`;
          }
          break;
        default:
          break;
      }

      const mensagemFallback = extractLogMessage(log);
      if (mensagemFallback) return mensagemFallback;
      return `${usuario} atualizou a sinalização de provável alta.`;
    },
    [getDetalhesObjeto, getNomeUsuario, normalizar]
  );

  const formatAltaLeitoMensagem = useCallback(
    (log) => {
      const detalhes = getDetalhesObjeto(log);
      const usuario = getNomeUsuario(log);
      const paciente = detalhes.pacienteNome || detalhes.paciente || '';
      const motivo = detalhes.motivo || detalhes.justificativa;

      switch (normalizar(log?.action)) {
        case normalizar('Alta no Leito Adicionada'):
          if (paciente) {
            const motivoTexto = motivo ? `. Motivo: ${motivo}.` : '.';
            return `${usuario} adicionou a sinalização de Alta no Leito para ${paciente}${motivoTexto}`;
          }
          break;
        case normalizar('Alta no Leito Removida'):
          if (paciente) {
            return `${usuario} removeu a sinalização de Alta no Leito para ${paciente}.`;
          }
          break;
        default:
          break;
      }

      const mensagemFallback = extractLogMessage(log);
      if (mensagemFallback) return mensagemFallback;
      return `${usuario} atualizou a sinalização de alta no leito.`;
    },
    [getDetalhesObjeto, getNomeUsuario, normalizar]
  );

  const formatReservaMensagem = useCallback((reserva) => {
    if (!reserva) return 'Atualização de reserva registrada.';

    const usuario = reserva.userName || 'Usuário';
    const paciente = reserva.pacienteNome || reserva.nomeCompleto || 'paciente';
    const origem = reserva.origem || 'Origem não informada';
    const leito = reserva.leitoCodigo || reserva.leitoReservadoCodigo || reserva.leitoReservadoId;
    const motivoCancelamento = reserva.motivoCancelamento || reserva.motivo || reserva.justificativa;
    const statusNormalizado = normalizar(reserva.status);

    switch (statusNormalizado) {
      case normalizar('Criada'):
      case normalizar('Aguardando Leito'):
        return `${usuario} criou uma reserva para o paciente "${paciente}" da origem "${origem}".`;
      case normalizar('Reservado'):
        if (leito) {
          return `${usuario} associou o leito "${leito}" à reserva do paciente "${paciente}".`;
        }
        return `${usuario} atualizou a reserva do paciente "${paciente}" para o status Reservado.`;
      case normalizar('Cancelada'):
        return `${usuario} cancelou a reserva para "${paciente}"${
          motivoCancelamento ? `. Motivo: "${motivoCancelamento}".` : '.'
        }`;
      case normalizar('Concluída'):
      case normalizar('Concluida'):
      case normalizar('Internado'):
        return `Internação da reserva de "${paciente}" foi confirmada${
          leito ? ` no leito "${leito}"` : ''
        } por "${usuario}".`;
      default:
        return `${usuario} atualizou a reserva de "${paciente}" para o status "${reserva.status || 'Indefinido'}".`;
    }
  }, [normalizar]);

  const formatMensagemPorAba = useCallback(
    (tab, log) => {
      switch (tab) {
        case 'regulacao':
          return formatRegulacaoMensagem(log);
        case 'status-leitos':
          return formatStatusLeitoMensagem(log);
        case 'pedidos':
          return formatPedidosMensagem(log);
        case 'observacoes':
          return formatObservacaoMensagem(log);
        case 'provaveis-altas':
          return formatProvavelAltaMensagem(log);
        case 'altas-leito':
          return formatAltaLeitoMensagem(log);
        case 'reservas':
          return formatReservaMensagem(log);
        default:
          return extractLogMessage(log) || `${getNomeUsuario(log)} registrou uma atividade.`;
      }
    },
    [
      formatAltaLeitoMensagem,
      formatObservacaoMensagem,
      formatPedidosMensagem,
      formatProvavelAltaMensagem,
      formatRegulacaoMensagem,
      formatStatusLeitoMensagem,
      formatReservaMensagem,
      getNomeUsuario,
    ]
  );

  const replaceInfeccaoIdWithSigla = useCallback(
    (mensagem) => {
      if (!mensagem) return mensagem;

      let textoFormatado = mensagem;
      const escapeRegex = (valor) => String(valor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      infeccoes.forEach((infeccao) => {
        if (!infeccao?.id) return;
        const idTexto = String(infeccao.id);
        if (!textoFormatado.includes(idTexto)) return;

        const padraoId = new RegExp(escapeRegex(idTexto), "g");
        textoFormatado = textoFormatado.replace(
          padraoId,
          infeccao.siglaInfeccao || infeccao.nomeInfeccao || idTexto
        );
      });

      return textoFormatado;
    },
    [infeccoes]
  );

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

    if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
      return 'Agora';
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

  const formatarLegendaLog = (log) => {
    if (!log) return '';

    const moduloBase =
      log.type === 'reserva'
        ? 'Reservas'
        : extractLogModule(log) || log?.action;
    const tempo = formatarTempoRelativo(extrairDataEvento(log) || log.timestamp);

    if (moduloBase && tempo) {
      return `${moduloBase} • ${tempo}`;
    }

    return moduloBase || tempo || '';
  };

  // Data atual formatada
  const dataAtual = format(new Date(), 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: ptBR });

  // Filtrar módulos baseado nas permissões
  const availableModules = moduleCards.filter(module => {
    const navItem = navigationItems.find(nav => nav.id === module.id);
    return navItem && hasPermission(navItem.route);
  });

  const atividadeTabs = [
    {
      value: "regulacao",
      label: "Regulação",
      logs: regulacaoLogs,
      emptyMessage: "Nenhuma atividade de regulação registrada.",
    },
    {
      value: "reservas",
      label: "Reservas",
      logs: reservasLogs,
      emptyMessage: "Nenhuma atividade de reservas registrada.",
    },
    {
      value: "isolamentos",
      label: "Isolamentos",
      logs: isolamentoLogs,
      emptyMessage: "Nenhuma atividade de isolamento registrada.",
    },
    {
      value: "status-leitos",
      label: "Status dos Leitos",
      logs: statusLeitosLogs,
      emptyMessage: "Nenhuma alteração de status de leito registrada.",
    },
    {
      value: "higienizacoes",
      label: "Higienizações",
      logs: higienizacaoLogs,
      emptyMessage: "Nenhuma higienização registrada.",
    },
    {
      value: "pedidos",
      label: "Pedidos",
      logs: pedidosLogs,
      emptyMessage: "Nenhum pedido recente registrado.",
    },
    {
      value: "observacoes",
      label: "Observações",
      logs: observacoesLogs,
      emptyMessage: "Nenhuma observação registrada.",
    },
    {
      value: "altas-leito",
      label: "Altas no Leito",
      logs: altasLeitoLogs,
      emptyMessage: "Nenhuma alta registrada no leito.",
    },
    {
      value: "provaveis-altas",
      label: "Prováveis Altas",
      logs: provaveisAltasLogs,
      emptyMessage: "Nenhuma provável alta registrada.",
    },
  ];

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
          <Tabs defaultValue="regulacao" className="w-full">
            <div className="px-4 pt-4">
              <TabsList className="flex w-full flex-wrap gap-2 border-b border-border bg-transparent p-0">
                {atividadeTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-full border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:border-primary/30 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {atividadeTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0 px-4 pb-4">
                {tab.logs.length > 0 ? (
                  <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                    {tab.logs.map((log) => {
                      const mensagemBase = formatMensagemPorAba(tab.value, log);
                      const mensagemFormatada =
                        (tab.value === "isolamentos" ? replaceInfeccaoIdWithSigla(mensagemBase) : mensagemBase) ||
                        "Atividade registrada";

                      return (
                        <li key={log.id} className="py-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                              <Activity className="h-4 w-4" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium text-foreground">{mensagemFormatada}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatarLegendaLog(log)}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {tab.emptyMessage}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

// Componente Principal Interno (após autenticação) - Updated
const RegulaFacilApp = () => {
  const [currentPage, setCurrentPage] = useState("home");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobileLogoutOpen, setIsMobileLogoutOpen] = useState(false);

  const { currentUser, logout } = useAuth();
  
  // Controle de inatividade (logout automático)
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const warningShownRef = useRef(false);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    warningShownRef.current = false;

    if (!currentUser) return;

    // Aviso 5 minutos antes (config: 120 min inatividade, aviso aos 115)
    warningTimeoutRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        toast({
          title: 'Sessão expirando',
          description: 'Sua sessão expirará em 5 minutos por inatividade. Mova o mouse ou clique para continuar.',
          duration: 10000,
        });
      }
    }, 115 * 60 * 1000);

    // Logout após 120 minutos
    timeoutRef.current = setTimeout(() => {
      toast({ title: 'Sessão expirada', description: 'Você foi deslogado por inatividade.', variant: 'destructive' });
      logout();
    }, 120 * 60 * 1000);
  }, [currentUser, logout]);

  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!currentUser) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => document.addEventListener(event, handleActivity, { passive: true }));

    resetTimer();

    return () => {
      events.forEach((event) => document.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [currentUser, handleActivity, resetTimer]);


  useEffect(() => {
    const handleScroll = () => {
      setIsHeaderScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  
  // Navegação entre páginas
  const handleNavigate = (pageId) => {
    setCurrentPage(pageId);
    setMobileSidebarOpen(false);
    const newUrl = pathFromPage(pageId);

    if (window.location.pathname !== newUrl) {
      window.history.pushState({ page: pageId }, "", newUrl);
    } else {
      window.history.replaceState({ page: pageId }, "", newUrl);
    }
  };

  const handleMobileLogout = useCallback(() => {
    setIsMobileLogoutOpen(false);
    setMobileSidebarOpen(false);
    logout();
  }, [logout]);

  // Gerenciar navegação do browser
  useEffect(() => {
    const initialPage = pageFromPath(window.location.pathname);
    setCurrentPage(initialPage);
    window.history.replaceState(
      { page: initialPage },
      "",
      pathFromPage(initialPage)
    );

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
              return <AuditoriaPage />;
            case "gestao-pacientes":
              return <GestaoPacientesPage />;
            case "informacoes":
              return <InformacoesPage />;
            default:
              return <HomePage onNavigate={handleNavigate} currentUser={currentUser} />;
          }
        })()}
      </ProtectedRoute>
    );
  };

  return (
    <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
      <div className="min-h-screen bg-gradient-subtle">
        <Header
          currentPage={getPageTitle(currentPage)}
          onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          currentUser={currentUser}
          isScrolled={isHeaderScrolled}
        />

        <Sidebar
          isExpanded={sidebarExpanded}
          currentPage={currentPage}
          onNavigate={handleNavigate}
        />

        <SheetContent
          side="left"
          className="w-full max-w-xs border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden md:hidden"
        >
          <SidebarContent
            isExpanded
            currentPage={currentPage}
            onNavigate={handleNavigate}
            onRequestLogout={() => setIsMobileLogoutOpen(true)}
            onClose={() => setMobileSidebarOpen(false)}
            enableTooltips={false}
          />
        </SheetContent>

        <main
          className={cn(
            "transition-all duration-300 pt-16 pb-20",
            sidebarExpanded ? "md:ml-64" : "md:ml-16"
          )}
        >
          <div className="px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            {renderPageContent()}
          </div>
        </main>

        <Footer />
      </div>

      <AlertDialog open={isMobileLogoutOpen} onOpenChange={setIsMobileLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Saída</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja sair do sistema?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsMobileLogoutOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleMobileLogout}>
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

export default RegulaFacilApp;
