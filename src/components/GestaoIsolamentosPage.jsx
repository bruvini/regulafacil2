import React, { useState, useEffect, useMemo } from 'react';
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
  XCircle,
  Edit
} from 'lucide-react';
import {
  getInfeccoesCollection,
  getLeitosCollection,
  getPacientesCollection,
  getSetoresCollection,
  onSnapshot,
  doc,
  updateDoc,
  deleteField,
  serverTimestamp
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
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
  const [leitos, setLeitos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [pacientesEmRisco, setPacientesEmRisco] = useState([]);
  const [buscarPaciente, setBuscarPaciente] = useState('');
  
  // Estados dos modais
  const [showGerenciarInfeccoes, setShowGerenciarInfeccoes] = useState(false);
  const [showGerenciarIsolamentos, setShowGerenciarIsolamentos] = useState(false);
  const [showConfirmarIsolamento, setShowConfirmarIsolamento] = useState(false);
  const [showDescartarIsolamento, setShowDescartarIsolamento] = useState(false);
  const [showFinalizarIsolamento, setShowFinalizarIsolamento] = useState(false);
  const [showAlterarData, setShowAlterarData] = useState(false);
  const { currentUser } = useAuth();
  
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
      unsubscribePacientes();
      unsubscribeInfeccoes();
      unsubscribeLeitos();
      unsubscribeSetores();
    };
  }, []);

  const formatarLocalizacao = (setor, leito) => {
    if (!setor || !leito) {
      return 'Localização não informada';
    }

    const setorLabel = setor.siglaSetor || setor.nomeSetor || 'Setor não informado';
    const leitoLabel = leito.codigoLeito || 'Leito não informado';

    return `${setorLabel} - ${leitoLabel}`;
  };

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
  const { pacientesSuspeitos, pacientesConfirmados } = useMemo(() => {
    const termoBusca = buscarPaciente.trim().toLowerCase();
    const leitosPorId = new Map(leitos.map((leito) => [leito.id, leito]));
    const setoresPorId = new Map(setores.map((setor) => [setor.id, setor]));

    const pacientesProcessados = pacientes
      .filter((paciente) => {
        if (!termoBusca) return true;
        return paciente.nomePaciente?.toLowerCase().includes(termoBusca);
      })
      .map((paciente) => {
        const leito = paciente.leitoId ? leitosPorId.get(paciente.leitoId) : undefined;
        const setor = leito ? setoresPorId.get(leito.setorId) : undefined;

        return {
          ...paciente,
          leitoAtual: leito,
          setorAtual: setor,
          localizacaoAtual: formatarLocalizacao(setor, leito),
        };
      });

    const suspeitos = [];
    const confirmados = [];

    pacientesProcessados.forEach((paciente) => {
      const isolamentos = paciente.isolamentos || [];
      if (isolamentos.some((iso) => iso.status === 'Suspeito')) {
        suspeitos.push(paciente);
      }
      if (isolamentos.some((iso) => iso.status === 'Confirmado')) {
        confirmados.push(paciente);
      }
    });

    return { pacientesSuspeitos: suspeitos, pacientesConfirmados: confirmados };
  }, [pacientes, buscarPaciente, leitos, setores]);

  useEffect(() => {
    const normalizarTexto = (texto) =>
      String(texto || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

    const obterIsolamentosAtivos = (pacienteAtual) =>
      (pacienteAtual?.isolamentos || []).filter(
        (iso) => iso && (iso.status === 'Confirmado' || iso.status === 'Suspeito')
      );

    const normalizarIsolamentos = (pacienteAtual) => {
      const isolamentosAtivos = obterIsolamentosAtivos(pacienteAtual);

      if (isolamentosAtivos.length === 0) {
        return '';
      }

      return Array.from(
        new Set(
          isolamentosAtivos.map((iso) => {
            const identificador =
              iso?.infeccaoId ||
              iso?.infecaoId ||
              iso?.id ||
              iso?.codigo ||
              iso?.nome ||
              '';
            return String(identificador).trim().toLowerCase();
          })
        )
      )
        .filter(Boolean)
        .sort()
        .join('|');
    };

    const obterChaveQuartoDinamica = (setorId, leitoAtual) => {
      const codigo = String(leitoAtual?.codigoLeito || '').trim();
      const chave = (codigo.substring(0, 3) || '---').toUpperCase();
      return `${setorId || 'setor-desconhecido'}::${chave}`;
    };

    const setoresEmergenciaAlvo = new Set(
      ['PS DECISÃO CIRURGICA', 'PS DECISÃO CLINICA', 'SALA LARANJA'].map((nome) =>
        normalizarTexto(nome)
      )
    );

    const pacientesPorId = new Map(pacientes.map((paciente) => [paciente.id, paciente]));
    const leitosPorId = new Map(leitos.map((leito) => [leito.id, leito]));
    const setoresPorId = new Map(setores.map((setor) => [setor.id, setor]));
    const pacientesPorQuartoDinamico = new Map();
    const pacientesPorSetorEmergencia = new Map();

    pacientes.forEach((paciente) => {
      const leito = paciente.leitoId ? leitosPorId.get(paciente.leitoId) : undefined;
      if (!leito) return;

      const setor = leito.setorId ? setoresPorId.get(leito.setorId) : undefined;
      if (!setor) return;

      const tipoSetorNormalizado = normalizarTexto(setor.tipoSetor);

      if (['uti', 'centro cirurgico', 'centro cirúrgico'].includes(tipoSetorNormalizado)) {
        return;
      }

      const nomeSetorNormalizado = normalizarTexto(setor.nomeSetor);
      const isEnfermaria = tipoSetorNormalizado === 'enfermaria';
      const isEmergenciaAlvo = setoresEmergenciaAlvo.has(nomeSetorNormalizado);

      if (!isEnfermaria && !isEmergenciaAlvo) {
        return;
      }

      if (isEnfermaria) {
        const chaveQuarto = obterChaveQuartoDinamica(setor.id, leito);
        if (!pacientesPorQuartoDinamico.has(chaveQuarto)) {
          pacientesPorQuartoDinamico.set(chaveQuarto, []);
        }
        pacientesPorQuartoDinamico.get(chaveQuarto).push({ paciente, leito, setor });
      }

      if (isEmergenciaAlvo) {
        if (!pacientesPorSetorEmergencia.has(setor.id)) {
          pacientesPorSetorEmergencia.set(setor.id, []);
        }
        pacientesPorSetorEmergencia.get(setor.id).push({ paciente, leito, setor });
      }
    });

    const pacientesEmRiscoPorId = new Map();

    const registrarRisco = ({ paciente, leito, setor, isolamentosAtivos }) => {
      if (!pacientesEmRiscoPorId.has(paciente.id)) {
        pacientesEmRiscoPorId.set(paciente.id, {
          paciente,
          leito,
          setor,
          isolamentosAtivos,
          chaveIsolamento: normalizarIsolamentos(paciente),
        });
      }
    };

    pacientesPorQuartoDinamico.forEach((ocupantes) => {
      if (!ocupantes || ocupantes.length <= 1) {
        return;
      }

      const pacientesComIsolamento = [];
      const pacientesSemIsolamento = [];

      ocupantes.forEach((item) => {
        const isolamentosAtivos = obterIsolamentosAtivos(item.paciente);
        if (isolamentosAtivos.length > 0) {
          pacientesComIsolamento.push({ ...item, isolamentosAtivos });
        } else {
          pacientesSemIsolamento.push(item);
        }
      });

      if (pacientesComIsolamento.length === 0) {
        return;
      }

      if (pacientesSemIsolamento.length > 0) {
        pacientesComIsolamento.forEach((item) => registrarRisco(item));
        return;
      }

      const assinaturas = new Set(
        pacientesComIsolamento.map((item) => normalizarIsolamentos(item.paciente))
      );

      if (assinaturas.size > 1) {
        pacientesComIsolamento.forEach((item) => registrarRisco(item));
      }
    });

    pacientesPorSetorEmergencia.forEach((ocupantes) => {
      if (!ocupantes || ocupantes.length === 0) {
        return;
      }

      const pacientesComIsolamento = [];
      const pacientesSemIsolamento = [];

      ocupantes.forEach((item) => {
        const isolamentosAtivos = obterIsolamentosAtivos(item.paciente);
        if (isolamentosAtivos.length > 0) {
          pacientesComIsolamento.push({ ...item, isolamentosAtivos });
        } else {
          pacientesSemIsolamento.push(item);
        }
      });

      if (pacientesComIsolamento.length > 0 && pacientesSemIsolamento.length > 0) {
        pacientesComIsolamento.forEach((item) => registrarRisco(item));
      } else if (pacientesComIsolamento.length > 1) {
        const assinaturas = new Set(
          pacientesComIsolamento.map((item) => normalizarIsolamentos(item.paciente))
        );

        if (assinaturas.size > 1) {
          pacientesComIsolamento.forEach((item) => registrarRisco(item));
        }
      }
    });

    const pacientesEmRiscoDetectados = Array.from(pacientesEmRiscoPorId.values());

    setPacientesEmRisco(pacientesEmRiscoDetectados);

    const processarRiscos = async (pacientesEmRiscoAtual) => {
      const idsEmRisco = new Set(pacientesEmRiscoAtual.map(({ paciente }) => paciente.id));

      for (const { paciente, isolamentosAtivos } of pacientesEmRiscoAtual) {
        try {
          const pedidoAtual = paciente?.pedidoRemanejamento;
          if (pedidoAtual?.tipo === 'Risco de Contaminação Cruzada') {
            continue;
          }

          const pacienteRef = doc(getPacientesCollection(), paciente.id);
          const siglasIsolamentos = (isolamentosAtivos || [])
            .map((iso) => {
              const infeccaoId = iso?.infeccaoId || iso?.infecaoId;
              if (!infeccaoId) return null;
              const infeccaoEncontrada = infeccoes.find((inf) => inf.id === infeccaoId);
              if (infeccaoEncontrada) {
                return infeccaoEncontrada.siglaInfeccao || infeccaoEncontrada.nomeInfeccao;
              }
              return `ID:${infeccaoId}`;
            })
            .filter(Boolean);

          const descricaoBase = siglasIsolamentos.length
            ? `Paciente com coorte de isolamento incompatível (Isolamentos: ${siglasIsolamentos.join(', ')})`
            : 'Paciente com coorte de isolamento incompatível';

          const descricao = `${descricaoBase}.`;

          await updateDoc(pacienteRef, {
            pedidoRemanejamento: {
              tipo: 'Risco de Contaminação Cruzada',
              descricao,
              detalhe: descricao,
              timestamp: serverTimestamp(),
            },
          });

          await logAction(
            'Gestão de Isolamentos',
            `Pedido de remanejamento automático criado para o paciente '${paciente.nomePaciente}' devido a risco de contaminação.`,
            currentUser
          );
        } catch (error) {
          console.error('Erro ao criar pedido automático de remanejamento:', error);
        }
      }

      for (const paciente of pacientesPorId.values()) {
        try {
          const pedido = paciente?.pedidoRemanejamento;
          if (pedido?.tipo !== 'Risco de Contaminação Cruzada') {
            continue;
          }

          if (idsEmRisco.has(paciente.id)) {
            continue;
          }

          const pacienteRef = doc(getPacientesCollection(), paciente.id);
          await updateDoc(pacienteRef, {
            pedidoRemanejamento: deleteField(),
          });

          await logAction(
            'Gestão de Isolamentos',
            `Pedido de remanejamento automático do paciente '${paciente.nomePaciente}' foi resolvido.`,
            currentUser
          );
        } catch (error) {
          console.error('Erro ao resolver pedido automático de remanejamento:', error);
        }
      }
    };

    processarRiscos(pacientesEmRiscoDetectados).catch((error) => {
      console.error('Erro durante o processamento dos riscos de contaminação:', error);
    });
  }, [pacientes, leitos, setores, infeccoes]);

  const AlertasRiscoContaminacaoPanel = ({ pacientesEmRisco }) => {
    if (!pacientesEmRisco.length) {
      return null;
    }

    return (
      <Card>
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="alertas-risco">
              <AccordionTrigger className="flex items-center justify-between gap-2 text-left">
                <span className="font-semibold">Alertas de Risco de Contaminação Cruzada</span>
                <Badge variant="destructive">{pacientesEmRisco.length}</Badge>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {pacientesEmRisco.map(({ paciente, setor, leito, isolamentosAtivos }) => {
                    const localizacao = formatarLocalizacao(setor, leito);
                    const isolamentosDescricao = isolamentosAtivos.length
                      ? isolamentosAtivos
                          .map((iso) => getInfeccaoNome(iso.infeccaoId))
                          .join(', ')
                      : 'Não informado';

                    return (
                      <Card
                        key={paciente.id}
                        className="border border-destructive/30 bg-destructive/5"
                      >
                        <CardContent className="py-4">
                          <div className="space-y-2 text-sm">
                            <div className="font-semibold">{paciente.nomePaciente}</div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Localização: </span>
                              <span className="font-semibold">{localizacao}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Isolamentos ativos: </span>
                              <span>{isolamentosDescricao}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Um pedido de remanejamento automático foi criado para este paciente.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    );
  };

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

      <AlertasRiscoContaminacaoPanel pacientesEmRisco={pacientesEmRisco} />

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
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Localização: </span>
                          <span className="font-semibold">{paciente.localizacaoAtual}</span>
                        </div>
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
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Localização: </span>
                          <span className="font-semibold">{paciente.localizacaoAtual}</span>
                        </div>
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