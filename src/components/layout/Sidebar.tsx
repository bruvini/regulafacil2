import { cn } from "@/lib/utils";
import {
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  isExpanded: boolean;
  currentPage: string;
  onNavigate: (page: string) => void;
}

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

const Sidebar = ({ isExpanded, currentPage, onNavigate }: SidebarProps) => {
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

export default Sidebar;