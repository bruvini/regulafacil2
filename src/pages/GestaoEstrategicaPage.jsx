import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight,
  BarChart3,
  Activity,
  Sparkles,
  Shield,
  FileSearch
} from 'lucide-react';
import MapaLeitosDashboard from '@/components/dashboards/MapaLeitosDashboard';
import RegulacaoLeitosDashboard from '@/components/dashboards/RegulacaoLeitosDashboard';
import CentralHigienizacaoDashboard from '@/components/dashboards/CentralHigienizacaoDashboard';
import GestaoIsolamentosDashboard from '@/components/dashboards/GestaoIsolamentosDashboard';
import AuditoriasDashboard from '@/components/dashboards/AuditoriasDashboard';

// Configuração dos slides do dashboard
const dashboardSlides = [
  {
    id: 'mapa-leitos',
    title: 'Mapa de Leitos',
    subtitle: 'Internações por Especialidade',
    icon: BarChart3,
    color: 'bg-blue-500',
    component: MapaLeitosDashboard
  },
  {
    id: 'regulacao-leitos',
    title: 'Regulação de Leitos',
    subtitle: 'Indicadores de Regulação',
    icon: Activity,
    color: 'bg-green-500',
    component: RegulacaoLeitosDashboard
  },
  {
    id: 'central-higienizacao',
    title: 'Central de Higienização',
    subtitle: 'Status de Limpeza',
    icon: Sparkles,
    color: 'bg-purple-500',
    component: CentralHigienizacaoDashboard
  },
  {
    id: 'gestao-isolamentos',
    title: 'Gestão de Isolamentos',
    subtitle: 'Monitoramento de Isolamentos',
    icon: Shield,
    color: 'bg-red-500',
    component: GestaoIsolamentosDashboard
  },
  {
    id: 'auditorias',
    title: 'Auditorias',
    subtitle: 'Atividades e Controles',
    icon: FileSearch,
    color: 'bg-gray-500',
    component: AuditoriasDashboard
  }
];

const GestaoEstrategicaPage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef(null);

  // Configuração do autoplay
  const SLIDE_DURATION = 30000; // 30 segundos

  // Função para avançar para o próximo slide
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % dashboardSlides.length);
  };

  // Função para voltar ao slide anterior
  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + dashboardSlides.length) % dashboardSlides.length);
  };

  // Função para ir para um slide específico
  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Toggle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Controle do autoplay
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        nextSlide();
      }, SLIDE_DURATION);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isPlaying]);

  // Cleanup quando o componente desmonta
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const currentDashboard = dashboardSlides[currentSlide];
  const CurrentDashboardComponent = currentDashboard.component;
  const CurrentIcon = currentDashboard.icon;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header com controles */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Título e indicador de slide */}
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-full ${currentDashboard.color} text-white`}>
              <CurrentIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {currentDashboard.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {currentDashboard.subtitle}
              </p>
            </div>
            <Badge variant="outline" className="ml-4">
              {currentSlide + 1} de {dashboardSlides.length}
            </Badge>
          </div>

          {/* Controles de navegação */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={prevSlide}
              className="h-10 w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={togglePlay}
              className="h-10 w-10"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={nextSlide}
              className="h-10 w-10"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Indicadores de slide (pontos) */}
        <div className="flex justify-center mt-4 gap-2">
          {dashboardSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? currentDashboard.color
                  : 'bg-border hover:bg-muted-foreground'
              }`}
            />
          ))}
        </div>

        {/* Barra de progresso do autoplay */}
        {isPlaying && (
          <div className="mt-2 w-full bg-border rounded-full h-1 max-w-7xl mx-auto">
            <div
              className={`h-1 rounded-full ${currentDashboard.color} transition-all duration-100 ease-linear`}
              style={{
                animation: `progress ${SLIDE_DURATION}ms linear infinite`,
              }}
            />
          </div>
        )}
      </div>

      {/* Conteúdo do dashboard atual */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="transition-all duration-500 ease-in-out">
          <CurrentDashboardComponent />
        </div>
      </div>

      {/* CSS para a animação da barra de progresso */}
      <style jsx>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default GestaoEstrategicaPage;