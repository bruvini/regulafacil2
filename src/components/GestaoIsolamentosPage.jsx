import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Settings, 
  UserCog, 
  Search,
  Calendar,
  XCircle,
  Edit
} from 'lucide-react';
import { 
  getInfeccoesCollection,
  getPacientesCollection,
  onSnapshot
} from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import GerenciarInfeccoesModal from './modals/GerenciarInfeccoesModal';
import GerenciarIsolamentosModal from './modals/GerenciarIsolamentosModal';
import ConfirmarIsolamentoModal from './modals/ConfirmarIsolamentoModal';
import DescartarIsolamentoModal from './modals/DescartarIsolamentoModal';
import FinalizarIsolamentoModal from './modals/FinalizarIsolamentoModal';
import AlterarDataIsolamentoModal from './modals/AlterarDataIsolamentoModal';

const GestaoIsolamentosPage = () => {
  // Estados principais
  const [pacientes, setPacientes] = useState([]);
  const [infeccoes, setInfeccoes] = useState([]);
  const [buscarPaciente, setBuscarPaciente] = useState('');
  
  // Estados dos modais
  const [showGerenciarInfeccoes, setShowGerenciarInfeccoes] = useState(false);
  const [showGerenciarIsolamentos, setShowGerenciarIsolamentos] = useState(false);
  const [showConfirmarIsolamento, setShowConfirmarIsolamento] = useState(false);
  const [showDescartarIsolamento, setShowDescartarIsolamento] = useState(false);
  const [showFinalizarIsolamento, setShowFinalizarIsolamento] = useState(false);
  const [showAlterarData, setShowAlterarData] = useState(false);
  
  // Estados para ações específicas
  const [isolamentoSelecionado, setIsolamentoSelecionado] = useState(null);
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);

  // Buscar dados do Firestore
  useEffect(() => {
    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPacientes(pacientesData);
    });

    const unsubscribeInfeccoes = onSnapshot(getInfeccoesCollection(), (snapshot) => {
      const infeccoesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInfeccoes(infeccoesData);
    });

    return () => {
      unsubscribePacientes();
      unsubscribeInfeccoes();
    };
  }, []);

  // Função para obter nome da infecção pelo ID
  const getInfeccaoNome = (infeccaoId) => {
    const infeccao = infeccoes.find(inf => inf.id === infeccaoId);
    return infeccao?.nomeInfeccao || 'Infecção não encontrada';
  };

  // Função para formatar data
  const formatarData = (data) => {
    if (!data) return 'Data inválida';
    
    let dataObj;
    if (typeof data.toDate === 'function') {
      dataObj = data.toDate();
    } else if (data instanceof Date) {
      dataObj = data;
    } else if (typeof data === 'string') {
      dataObj = new Date(data);
    } else {
      return 'Data inválida';
    }
    
    return format(dataObj, 'dd/MM/yyyy', { locale: ptBR });
  };

  // Filtrar pacientes por busca
  const pacientesFiltrados = pacientes.filter(paciente => 
    !buscarPaciente || 
    paciente.nomePaciente?.toLowerCase().includes(buscarPaciente.toLowerCase())
  );

  // Filtrar pacientes suspeitos
  const pacientesSuspeitos = pacientesFiltrados.filter(paciente => 
    paciente.isolamentos?.some(iso => iso.status === 'Suspeito')
  );

  // Filtrar pacientes confirmados
  const pacientesConfirmados = pacientesFiltrados.filter(paciente => 
    paciente.isolamentos?.some(iso => iso.status === 'Confirmado')
  );

  // Handlers dos modais
  const handleConfirmarIsolamento = (paciente, isolamento) => {
    setPacienteSelecionado(paciente);
    setIsolamentoSelecionado(isolamento);
    setShowConfirmarIsolamento(true);
  };

  const handleDescartarIsolamento = (paciente, isolamento) => {
    setPacienteSelecionado(paciente);
    setIsolamentoSelecionado(isolamento);
    setShowDescartarIsolamento(true);
  };

  const handleFinalizarIsolamento = (paciente, isolamento) => {
    setPacienteSelecionado(paciente);
    setIsolamentoSelecionado(isolamento);
    setShowFinalizarIsolamento(true);
  };

  const handleAlterarData = (paciente, isolamento) => {
    setPacienteSelecionado(paciente);
    setIsolamentoSelecionado(isolamento);
    setShowAlterarData(true);
  };

  return (
    <div className="space-y-6">
      {/* Indicadores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Indicadores de Isolamento (em desenvolvimento)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Dashboard com métricas de isolamento será implementado em breve.
          </div>
        </CardContent>
      </Card>

      {/* Caixa de Ferramentas */}
      <Card>
        <CardHeader>
          <CardTitle>Ferramentas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button 
              variant="outline" 
              className="flex flex-col items-center justify-center h-16 gap-2"
              onClick={() => setShowGerenciarInfeccoes(true)}
            >
              <Settings className="h-4 w-4" />
              <span className="text-xs text-center">Gerenciar Infecções</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col items-center justify-center h-16 gap-2"
              onClick={() => setShowGerenciarIsolamentos(true)}
            >
              <UserCog className="h-4 w-4" />
              <span className="text-xs text-center">Gerenciar Isolamentos</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtro de Busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente por nome..."
              value={buscarPaciente}
              onChange={(e) => setBuscarPaciente(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Painéis de Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pacientes Suspeitos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pacientes Suspeitos
              <Badge variant="secondary">{pacientesSuspeitos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pacientesSuspeitos.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Nenhum paciente com isolamento suspeito encontrado
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {pacientesSuspeitos.map((paciente) => (
                  <AccordionItem key={paciente.id} value={paciente.id}>
                    <AccordionTrigger className="text-left">
                      {paciente.nomePaciente}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {paciente.isolamentos
                          ?.filter(iso => iso.status === 'Suspeito')
                          .map((isolamento) => (
                            <div 
                              key={isolamento.id} 
                              className="p-3 bg-amber-50 border border-amber-200 rounded-lg"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-sm">
                                    {getInfeccaoNome(isolamento.infeccaoId)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Inclusão: {formatarData(isolamento.dataInclusao)}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={() => handleDescartarIsolamento(paciente, isolamento)}
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => handleConfirmarIsolamento(paciente, isolamento)}
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        {/* Pacientes Confirmados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-red-500" />
              Pacientes Confirmados
              <Badge variant="destructive">{pacientesConfirmados.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pacientesConfirmados.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Nenhum paciente com isolamento confirmado encontrado
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {pacientesConfirmados.map((paciente) => (
                  <AccordionItem key={paciente.id} value={paciente.id}>
                    <AccordionTrigger className="text-left">
                      {paciente.nomePaciente}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {paciente.isolamentos
                          ?.filter(iso => iso.status === 'Confirmado')
                          .map((isolamento) => (
                            <div 
                              key={isolamento.id} 
                              className="p-3 bg-red-50 border border-red-200 rounded-lg"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-sm">
                                    {getInfeccaoNome(isolamento.infeccaoId)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Inclusão: {formatarData(isolamento.dataInclusao)}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={() => handleAlterarData(paciente, isolamento)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2"
                                    onClick={() => handleFinalizarIsolamento(paciente, isolamento)}
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <GerenciarInfeccoesModal
        isOpen={showGerenciarInfeccoes}
        onClose={() => setShowGerenciarInfeccoes(false)}
        infeccoes={infeccoes}
      />

      <GerenciarIsolamentosModal
        isOpen={showGerenciarIsolamentos}
        onClose={() => setShowGerenciarIsolamentos(false)}
        pacientes={pacientes}
        infeccoes={infeccoes}
      />

      <ConfirmarIsolamentoModal
        isOpen={showConfirmarIsolamento}
        onClose={() => setShowConfirmarIsolamento(false)}
        paciente={pacienteSelecionado}
        isolamento={isolamentoSelecionado}
      />

      <DescartarIsolamentoModal
        isOpen={showDescartarIsolamento}
        onClose={() => setShowDescartarIsolamento(false)}
        paciente={pacienteSelecionado}
        isolamento={isolamentoSelecionado}
      />

      <FinalizarIsolamentoModal
        isOpen={showFinalizarIsolamento}
        onClose={() => setShowFinalizarIsolamento(false)}
        paciente={pacienteSelecionado}
        isolamento={isolamentoSelecionado}
      />

      <AlterarDataIsolamentoModal
        isOpen={showAlterarData}
        onClose={() => setShowAlterarData(false)}
        paciente={pacienteSelecionado}
        isolamento={isolamentoSelecionado}
      />
    </div>
  );
};

export default GestaoIsolamentosPage;