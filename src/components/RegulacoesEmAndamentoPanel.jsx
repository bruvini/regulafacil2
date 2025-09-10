import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader, ClipboardCopy, CheckCircle, Pencil, XCircle } from "lucide-react";
import { intervalToDuration, formatISO9075 } from 'date-fns';
import { 
  getSetoresCollection, 
  getLeitosCollection,
  getPacientesCollection,
  onSnapshot
} from '@/lib/firebase';

const RegulacoesEmAndamentoPanel = () => {
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [regulacoes, setRegulacoes] = useState([]);
  const [loading, setLoading] = useState(true);

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
      
      // Filtrar apenas pacientes com regulação ativa
      const pacientesComRegulacao = pacientesData.filter(p => 
        p.regulacaoAtiva && 
        p.regulacaoAtiva.leitoOrigemId && 
        p.regulacaoAtiva.leitoDestinoId
      );
      
      setRegulacoes(pacientesComRegulacao);
      setLoading(false);
    });

    return () => {
      unsubscribeSetores();
      unsubscribeLeitos();
      unsubscribePacientes();
    };
  }, []);

  // Função para calcular tempo desde o início da regulação
  const calcularTempoRegulacao = (iniciadoEm) => {
    if (!iniciadoEm) return 'Tempo não definido';
    
    let dataObj;
    
    // Se for um timestamp do Firebase
    if (iniciadoEm && typeof iniciadoEm.toDate === 'function') {
      dataObj = iniciadoEm.toDate();
    }
    // Se for já um objeto Date ou string de data
    else {
      dataObj = new Date(iniciadoEm);
    }
    
    // Verificar se a data é válida
    if (isNaN(dataObj.getTime())) {
      return 'Tempo inválido';
    }
    
    const agora = new Date();
    const duracao = intervalToDuration({ start: dataObj, end: agora });
    
    if (duracao.hours > 0) {
      return `Ativa há ${duracao.hours}h ${duracao.minutes || 0}m`;
    } else {
      return `Ativa há ${duracao.minutes || 0}m`;
    }
  };

  // Função para obter informações do leito
  const obterInfoLeito = (leitoId) => {
    const leito = leitos.find(l => l.id === leitoId);
    if (!leito) return { codigo: 'N/A', siglaSetor: 'N/A' };
    
    const setor = setores.find(s => s.id === leito.setorId);
    return {
      codigo: leito.codigoLeito || 'N/A',
      siglaSetor: setor?.siglaSetor || 'N/A'
    };
  };

  const RegulacaoCard = ({ paciente }) => {
    const { regulacaoAtiva } = paciente;
    const leitoOrigem = obterInfoLeito(regulacaoAtiva.leitoOrigemId);
    const leitoDestino = obterInfoLeito(regulacaoAtiva.leitoDestinoId);
    const tempoRegulacao = calcularTempoRegulacao(regulacaoAtiva.iniciadoEm);

    return (
      <Card className="p-4 hover:shadow-md transition-shadow border border-muted">
        <div className="space-y-3">
          {/* Nome do Paciente */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight truncate">
                {paciente.nomePaciente}
              </h4>
            </div>
            <Badge variant="outline" className="text-xs font-medium bg-orange-100 text-orange-800 border-orange-300">
              Em Regulação
            </Badge>
          </div>

          {/* Origem e Destino */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              <span className="font-medium">DE: </span>
              <span className="font-semibold">{leitoOrigem.siglaSetor} - {leitoOrigem.codigo}</span>
            </div>
            <div>
              <span className="font-medium">PARA: </span>
              <span className="font-semibold">{leitoDestino.siglaSetor} - {leitoDestino.codigo}</span>
            </div>
          </div>

          {/* Tempo da Regulação */}
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{tempoRegulacao}</span>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                    <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copiar Texto Personalizado</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Concluir Regulação</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                    <Pencil className="h-4 w-4 text-blue-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Alterar Regulação</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                    <XCircle className="h-4 w-4 text-destructive" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cancelar Regulação</p>
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
          <Loader className="h-5 w-5 text-orange-600" />
          Regulações em Andamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando regulações...</span>
          </div>
        ) : regulacoes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma regulação em andamento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regulacoes.map((paciente) => (
              <RegulacaoCard key={paciente.id} paciente={paciente} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegulacoesEmAndamentoPanel;