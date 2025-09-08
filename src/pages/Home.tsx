import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
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
} from "lucide-react";

interface HomeProps {
  onNavigate: (page: string) => void;
}

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

const Home = ({ onNavigate }: HomeProps) => {
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

export default Home;