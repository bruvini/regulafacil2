import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowRightCircle, LogOut, Users } from "lucide-react";
import { intervalToDuration, formatISO9075 } from 'date-fns';
import { 
  getSetoresCollection, 
  getLeitosCollection,
  getPacientesCollection,
  onSnapshot
} from '@/lib/firebase';

const AguardandoRegulacaoPanel = () => {
  const [setores, setSetores] = useState([]);
  const [pacientes, setPacientes] = useState([]);

  useEffect(() => {
    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSetores(setoresData);
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
      unsubscribePacientes();
    };
  }, []);

  // Função para calcular idade a partir da data de nascimento
  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return 0;
    
    let dataObj;
    
    // Se for uma string no formato dd/mm/aaaa
    if (typeof dataNascimento === 'string' && dataNascimento.includes('/')) {
      const [dia, mes, ano] = dataNascimento.split('/');
      dataObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    } 
    // Se for um timestamp do Firebase
    else if (dataNascimento && typeof dataNascimento.toDate === 'function') {
      dataObj = dataNascimento.toDate();
    }
    // Se for já um objeto Date ou string de data
    else {
      dataObj = new Date(dataNascimento);
    }
    
    // Verificar se a data é válida
    if (isNaN(dataObj.getTime())) {
      return 0;
    }
    
    const hoje = new Date();
    let idade = hoje.getFullYear() - dataObj.getFullYear();
    const m = hoje.getMonth() - dataObj.getMonth();
    
    if (m < 0 || (m === 0 && hoje.getDate() < dataObj.getDate())) {
      idade--;
    }
    
    return idade;
  };

  // Função para calcular tempo de internação
  const calcularTempoInternacao = (dataInternacao) => {
    if (!dataInternacao) return '';
    
    let dataObj;
    
    // Se for uma string no formato dd/mm/aaaa
    if (typeof dataInternacao === 'string' && dataInternacao.includes('/')) {
      const [dia, mes, ano] = dataInternacao.split('/');
      dataObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    } 
    // Se for um timestamp do Firebase
    else if (dataInternacao && typeof dataInternacao.toDate === 'function') {
      dataObj = dataInternacao.toDate();
    }
    // Se for já um objeto Date ou string de data
    else {
      dataObj = new Date(dataInternacao);
    }
    
    // Verificar se a data é válida
    if (isNaN(dataObj.getTime())) {
      return '';
    }
    
    const agora = new Date();
    const duracao = intervalToDuration({ start: dataObj, end: agora });
    
    if (duracao.days > 0) {
      return `${duracao.days}d ${duracao.hours || 0}h`;
    } else if (duracao.hours > 0) {
      return `${duracao.hours}h ${duracao.minutes || 0}m`;
    } else {
      return `${duracao.minutes || 0}m`;
    }
  };

  // Filtrar pacientes pelos setores específicos
  const setoresRegulacao = ["PS DECISÃO CLINICA", "PS DECISÃO CIRURGICA", "CC - RECUPERAÇÃO"];
  
  const getSetorByName = (nome) => setores.find((s) => s?.nomeSetor === nome);

  const pacientesPorSetor = setoresRegulacao.reduce((acc, nomeSetor) => {
    const setorRef = getSetorByName(nomeSetor);
    acc[nomeSetor] = pacientes.filter((p) => {
      const nomeDoSetorDoPaciente = p?.setor?.nomeSetor;
      const codigoSetorDoPaciente = p?.codigoSetor;
      const codigoSetorAlvo = setorRef?.codigoSetor;
      // Prioridade: comparar por nomeSetor dentro de p.setor; fallback para codigoSetor
      return (
        nomeDoSetorDoPaciente === nomeSetor ||
        (codigoSetorDoPaciente && codigoSetorAlvo && codigoSetorDoPaciente === codigoSetorAlvo)
      );
    });
    return acc;
  }, {});

  const PacienteCard = ({ paciente, setor }) => {
    const idade = calcularIdade(paciente.dataNascimento);
    const sexoSigla = paciente.sexo === 'MASCULINO' ? 'M' : 'F';
    const tempoInternacao = calcularTempoInternacao(paciente.dataInternacao);
    const mostrarTempo = setor === "PS DECISÃO CLINICA" || setor === "PS DECISÃO CIRURGICA";

    return (
      <Card className="p-4 hover:shadow-md transition-shadow border border-muted">
        <div className="space-y-3">
          {/* Nome e Badge Idade/Sexo */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight truncate">
                {paciente.nomePaciente}
              </h4>
            </div>
            <Badge variant="outline" className="text-xs font-medium">
              {idade} {sexoSigla}
            </Badge>
          </div>

          {/* Especialidade */}
          <p className="text-xs text-muted-foreground">
            {paciente.especialidade || 'Não informado'}
          </p>

          {/* Tempo de Internação (condicional) */}
          {mostrarTempo && tempoInternacao && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Tempo: </span>
              {tempoInternacao}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                    <ArrowRightCircle className="h-4 w-4 text-primary" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Regular Paciente</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                    <LogOut className="h-4 w-4 text-destructive" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Dar Alta</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-blue-600" />
          Pacientes Aguardando Regulação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {setoresRegulacao.map((nomeSetor) => (
            <div key={nomeSetor} className="space-y-4">
              {/* Título da Coluna */}
              <div className="border-b pb-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {nomeSetor}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {pacientesPorSetor[nomeSetor]?.length || 0} paciente(s)
                </p>
              </div>

              {/* Lista de Pacientes */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pacientesPorSetor[nomeSetor]?.length > 0 ? (
                  pacientesPorSetor[nomeSetor].map((paciente) => (
                    <PacienteCard 
                      key={paciente.id} 
                      paciente={paciente} 
                      setor={nomeSetor}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum paciente aguardando</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AguardandoRegulacaoPanel;