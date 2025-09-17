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
import { useAuth } from '@/contexts/AuthContext';

import IniciarHigienizacaoModal from './modals/IniciarHigienizacaoModal';

const CentralHigienizacaoPage = () => {
  // Estados principais
  const [leitos, setLeitos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState({});
  const [iniciarModalOpen, setIniciarModalOpen] = useState(false);
  const [leitoSelecionado, setLeitoSelecionado] = useState(null);

  const { currentUser } = useAuth();

  const getUsuarioNome = () =>
    currentUser?.nomeCompleto ||
    currentUser?.displayName ||
    currentUser?.emailInstitucional ||
    currentUser?.email ||
    'Usuário';

  const converterParaData = (valor) => {
    if (!valor) return null;
    if (valor instanceof Date) return valor;
    if (typeof valor.toDate === 'function') return valor.toDate();
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  };

  const formatarDuracao = (dataInicio) => {
    if (!dataInicio) return null;

    const agora = new Date();
    const duration = intervalToDuration({ start: dataInicio, end: agora });

    if (!duration) return null;

    let textoFormatado;
    if (duration.days && duration.days > 0) {
      textoFormatado = `${duration.days}d ${duration.hours || 0}h ${duration.minutes || 0}m`;
    } else if (duration.hours && duration.hours > 0) {
      textoFormatado = `${duration.hours}h ${duration.minutes || 0}m`;
    } else {
      textoFormatado = `${duration.minutes || 0}m`;
    }

    const totalMinutos = (duration.days || 0) * 24 * 60 +
      (duration.hours || 0) * 60 +
      (duration.minutes || 0);

    return {
      texto: textoFormatado,
      totalMinutos
    };
  };

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
      const dadosHigienizacao = leito.higienizacaoEmAndamento || null;
      const inicioHigienizacao = converterParaData(dadosHigienizacao?.inicioTimestamp);
      const infoHigienizacao = formatarDuracao(inicioHigienizacao);

      let infoEspera = null;
      if (Array.isArray(leito.historico) && leito.historico.length > 0) {
        const registroHigienizacao = [...leito.historico]
          .reverse()
          .find(item => item.status === 'Higienização');

        if (registroHigienizacao?.timestamp) {
          const dataInicio = converterParaData(registroHigienizacao.timestamp);
          infoEspera = formatarDuracao(dataInicio);
        }
      }

      return {
        ...leito,
        tempoNoStatus: infoEspera?.texto || null,
        tempoHigienizacao: infoHigienizacao?.texto || null,
        totalMinutosEspera: infoHigienizacao?.totalMinutos ?? infoEspera?.totalMinutos ?? 0
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

  const handleIniciarHigienizacao = async (leito, tipoDeLimpeza) => {
    if (!leito || !tipoDeLimpeza) {
      toast({
        title: "Selecione o tipo de higienização",
        description: "É necessário escolher o tipo de limpeza para iniciar o processo.",
        variant: "destructive"
      });
      return;
    }

    setLoading(prev => ({ ...prev, [leito.id]: true }));

    try {
      const leitoRef = doc(db, getLeitosCollection().path, leito.id);
      const usuarioNome = getUsuarioNome();
      const inicioTimestamp = new Date();

      await updateDoc(leitoRef, {
        higienizacaoEmAndamento: {
          tipo: tipoDeLimpeza,
          inicioTimestamp,
          usuarioInicio: usuarioNome
        }
      });

      await logAction(
        'Central de Higienização',
        `Higienização ${tipoDeLimpeza} iniciada no leito '${leito.codigoLeito}' por ${usuarioNome}.`
      );

      toast({
        title: "Higienização iniciada",
        description: `Limpeza ${tipoDeLimpeza} iniciada no leito ${leito.codigoLeito}.`,
        variant: "default"
      });

      setIniciarModalOpen(false);
      setLeitoSelecionado(null);
    } catch (error) {
      console.error('Erro ao iniciar higienização:', error);
      toast({
        title: "Erro",
        description: "Erro ao iniciar higienização. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, [leito.id]: false }));
    }
  };

  // Função para concluir higienização
  const handleConcluirHigienizacao = async (leito) => {
    setLoading(prev => ({ ...prev, [leito.id]: true }));

    try {
      const leitoRef = doc(db, getLeitosCollection().path, leito.id);

      const usuarioNome = getUsuarioNome();
      const dadosHigienizacao = leito.higienizacaoEmAndamento || {};
      const tipoHigienizacao = dadosHigienizacao.tipo || 'não informada';
      const inicioHigienizacao = converterParaData(dadosHigienizacao.inicioTimestamp);
      const detalhesHistorico = {
        tipo: dadosHigienizacao.tipo || null,
        usuarioInicio: dadosHigienizacao.usuarioInicio || null,
        inicioTimestamp: inicioHigienizacao || null,
        usuarioFim: usuarioNome,
        fimTimestamp: new Date()
      };
      const descricaoToast = dadosHigienizacao.tipo
        ? `Leito ${leito.codigoLeito} disponível após limpeza ${dadosHigienizacao.tipo}.`
        : `Leito ${leito.codigoLeito} disponível após higienização.`;

      await updateDoc(leitoRef, {
        status: 'Vago',
        higienizacaoPrioritaria: deleteField(),
        higienizacaoEmAndamento: deleteField(),
        historico: arrayUnion({
          status: 'Vago',
          timestamp: new Date(),
          detalhes: detalhesHistorico
        })
      });

      await logAction(
        'Central de Higienização',
        `Higienização ${tipoHigienizacao} concluída no leito '${leito.codigoLeito}' por ${usuarioNome}.`
      );

      toast({
        title: "Higienização concluída",
        description: descricaoToast,
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

  const abrirModalIniciar = (leito) => {
    setLeitoSelecionado(leito);
    setIniciarModalOpen(true);
  };

  const handleModalIniciarChange = (open) => {
    if (!open) {
      setLeitoSelecionado(null);
    }
    setIniciarModalOpen(open);
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
          {leitosAgrupados[setorId].map(leito => {
            const higienizacaoEmAndamento = Boolean(leito.higienizacaoEmAndamento);
            const tipoHigienizacao = leito.higienizacaoEmAndamento?.tipo;
            const usuarioInicio = leito.higienizacaoEmAndamento?.usuarioInicio;
            const tempoEspera = leito.tempoNoStatus;
            const tempoAndamento = leito.tempoHigienizacao;
            const aguardandoTexto = tempoEspera
              ? `Aguardando início há ${tempoEspera}`
              : 'Tempo de espera indisponível';
            const andamentoTexto = tempoAndamento
              ? `Em andamento há ${tempoAndamento}`
              : 'Tempo de execução indisponível';

            return (
              <div
                key={leito.id}
                className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border ${
                  isPrioritario
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-medium text-sm">
                    Leito {leito.codigoLeito}
                  </div>

                  {higienizacaoEmAndamento ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-blue-500" />
                        <span>
                          Higienização {tipoHigienizacao || 'em andamento'} iniciada por {usuarioInicio || 'usuário não informado'}.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>{andamentoTexto}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{aguardandoTexto}</span>
                    </div>
                  )}
                </div>

                {higienizacaoEmAndamento ? (
                  <Button
                    size="sm"
                    onClick={() => handleConcluirHigienizacao(leito)}
                    disabled={loading[leito.id]}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {loading[leito.id] ? 'Concluindo...' : 'Concluir Higienização'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => abrirModalIniciar(leito)}
                    disabled={loading[leito.id]}
                    className="h-8 text-xs"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {loading[leito.id] ? 'Iniciando...' : 'Iniciar Higienização'}
                  </Button>
                )}
              </div>
            );
          })}
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

      <IniciarHigienizacaoModal
        open={iniciarModalOpen}
        onOpenChange={handleModalIniciarChange}
        leito={leitoSelecionado}
        onConfirmar={(tipo) => leitoSelecionado && handleIniciarHigienizacao(leitoSelecionado, tipo)}
        loading={leitoSelecionado ? loading[leitoSelecionado.id] : false}
      />
    </div>
  );
};

export default CentralHigienizacaoPage;