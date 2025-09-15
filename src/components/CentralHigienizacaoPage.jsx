import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Sparkles, 
  Clock,
  CheckCircle2,
  BarChart3
} from 'lucide-react';
import { 
  getSetoresCollection,
  getLeitosCollection,
  onSnapshot,
  updateDoc,
  doc,
  arrayUnion,
  deleteField
} from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { toast } from '@/hooks/use-toast';
import { intervalToDuration } from 'date-fns';

const CentralHigienizacaoPage = () => {
  // Estados principais
  const [leitos, setLeitos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState({});

  // Buscar dados do Firestore em tempo real
  useEffect(() => {
    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeitos(leitosData);
    });

    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSetores(setoresData);
    });

    return () => {
      unsubscribeLeitos();
      unsubscribeSetores();
    };
  }, []);

  // Processamento dos dados com useMemo para performance
  const dadosProcessados = useMemo(() => {
    // 1. Filtrar apenas leitos em higienização
    const leitosEmHigienizacao = leitos.filter(leito => leito.status === 'Higienização');

    // 2. Calcular tempo no status para cada leito
    const leitosComTempo = leitosEmHigienizacao.map(leito => {
      let tempoNoStatus = null;
      
      if (leito.historico && leito.historico.length > 0) {
        const ultimoRegistro = leito.historico[leito.historico.length - 1];
        if (ultimoRegistro.timestamp) {
          let dataInicio;
          
          if (typeof ultimoRegistro.timestamp.toDate === 'function') {
            dataInicio = ultimoRegistro.timestamp.toDate();
          } else if (ultimoRegistro.timestamp instanceof Date) {
            dataInicio = ultimoRegistro.timestamp;
          } else {
            dataInicio = new Date(ultimoRegistro.timestamp);
          }
          
          const agora = new Date();
          const duration = intervalToDuration({ start: dataInicio, end: agora });
          
          // Formatar duração
          if (duration.days && duration.days > 0) {
            tempoNoStatus = `${duration.days}d ${duration.hours || 0}h ${duration.minutes || 0}m`;
          } else if (duration.hours && duration.hours > 0) {
            tempoNoStatus = `${duration.hours}h ${duration.minutes || 0}m`;
          } else {
            tempoNoStatus = `${duration.minutes || 0}m`;
          }
          
          // Para ordenação, converter para minutos totais
          const totalMinutos = (duration.days || 0) * 24 * 60 + 
                              (duration.hours || 0) * 60 + 
                              (duration.minutes || 0);
          
          return {
            ...leito,
            tempoNoStatus,
            totalMinutosEspera: totalMinutos
          };
        }
      }
      
      return {
        ...leito,
        tempoNoStatus: 'Tempo indisponível',
        totalMinutosEspera: 0
      };
    });

    // 3. Separar em prioritários e normais
    const leitosPrioritarios = leitosComTempo.filter(leito => leito.higienizacaoPrioritaria === true);
    const leitosNormais = leitosComTempo.filter(leito => leito.higienizacaoPrioritaria !== true);

    // 4. Função para agrupar e ordenar por setor
    const agruparPorSetor = (listaLeitos) => {
      const grupos = {};
      
      listaLeitos.forEach(leito => {
        const setorId = leito.setorId;
        if (!grupos[setorId]) {
          grupos[setorId] = [];
        }
        grupos[setorId].push(leito);
      });
      
      // Ordenar cada grupo por tempo (mais antigos primeiro)
      Object.keys(grupos).forEach(setorId => {
        grupos[setorId].sort((a, b) => b.totalMinutosEspera - a.totalMinutosEspera);
      });
      
      return grupos;
    };

    const leitosPrioritariosAgrupados = agruparPorSetor(leitosPrioritarios);
    const leitosNormaisAgrupados = agruparPorSetor(leitosNormais);

    return {
      leitosPrioritariosAgrupados,
      leitosNormaisAgrupados,
      totalPrioritarios: leitosPrioritarios.length,
      totalNormais: leitosNormais.length
    };
  }, [leitos]);

  // Função para obter nome do setor pelo ID
  const getNomeSetor = (setorId) => {
    const setor = setores.find(s => s.id === setorId);
    return setor?.nomeSetor || setor?.siglaSetor || 'Setor não encontrado';
  };

  // Função para concluir higienização
  const handleConcluirHigienizacao = async (leito) => {
    setLoading(prev => ({ ...prev, [leito.id]: true }));
    
    try {
      const leitoRef = doc(db, getLeitosCollection().path, leito.id);
      
      await updateDoc(leitoRef, {
        status: 'Vago',
        higienizacaoPrioritaria: deleteField(),
        historico: arrayUnion({
          status: 'Vago',
          timestamp: new Date()
        })
      });

      await logAction(
        'Central de Higienização',
        `Higienização do leito '${leito.codigoLeito}' foi concluída.`
      );

      toast({
        title: "Sucesso",
        description: `Higienização do leito ${leito.codigoLeito} concluída!`,
        variant: "default"
      });

    } catch (error) {
      console.error('Erro ao concluir higienização:', error);
      toast({
        title: "Erro",
        description: "Erro ao concluir higienização. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, [leito.id]: false }));
    }
  };

  // Renderizar lista de leitos por setor
  const renderLeitosPorSetor = (leitosAgrupados, isPrioritario = false) => {
    const setorIds = Object.keys(leitosAgrupados);
    
    if (setorIds.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          {isPrioritario ? 
            "Nenhuma higienização prioritária pendente" : 
            "Nenhuma higienização normal pendente"
          }
        </div>
      );
    }

    return setorIds.map(setorId => (
      <div key={setorId} className="space-y-3">
        <div className="flex items-center gap-2 pt-2">
          <h4 className="font-medium text-foreground">{getNomeSetor(setorId)}</h4>
          <Badge variant="secondary">{leitosAgrupados[setorId].length}</Badge>
        </div>
        
        <div className="space-y-2 pl-4">
          {leitosAgrupados[setorId].map(leito => (
            <div 
              key={leito.id} 
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isPrioritario 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="font-medium text-sm">
                  Leito {leito.codigoLeito}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Aguardando há {leito.tempoNoStatus}
                </div>
              </div>
              
              <Button
                size="sm"
                onClick={() => handleConcluirHigienizacao(leito)}
                disabled={loading[leito.id]}
                className="h-8 text-xs"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {loading[leito.id] ? 'Concluindo...' : 'Concluir'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Indicadores (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Indicadores de Higienização (em desenvolvimento)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Dashboard com métricas de performance da higienização será implementado em breve.
          </div>
        </CardContent>
      </Card>

      {/* Higienizações Prioritárias */}
      <Card className="border-red-200 shadow-lg">
        <CardHeader className="bg-red-50 border-b border-red-200">
          <CardTitle className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Higienizações Prioritárias
            <Badge variant="destructive" className="ml-2">
              {dadosProcessados.totalPrioritarios}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {renderLeitosPorSetor(dadosProcessados.leitosPrioritariosAgrupados, true)}
        </CardContent>
      </Card>

      {/* Demais Higienizações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Demais Leitos em Higienização
            <Badge variant="secondary" className="ml-2">
              {dadosProcessados.totalNormais}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {renderLeitosPorSetor(dadosProcessados.leitosNormaisAgrupados, false)}
        </CardContent>
      </Card>
    </div>
  );
};

export default CentralHigienizacaoPage;