import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { ArrowRightCircle, LogOut, Users, Shield } from "lucide-react";
import { intervalToDuration } from 'date-fns';
import {
  getSetoresCollection,
  getLeitosCollection,
  getPacientesCollection,
  onSnapshot,
  writeBatch,
  doc,
  deleteField,
  arrayUnion,
  db
} from '@/lib/firebase';
import RegularPacienteModal from '@/components/modals/RegularPacienteModal';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { useDadosHospitalares } from '@/hooks/useDadosHospitalares';

const extrairIsolamentosAtivos = (isolamentos) => {
  if (!isolamentos) return [];
  if (Array.isArray(isolamentos)) return isolamentos.filter(Boolean);
  if (typeof isolamentos === 'object') {
    return Object.values(isolamentos).filter(Boolean);
  }
  return [];
};

const normalizarTexto = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const normalizarSexo = (valor) => {
  const sexoNormalizado = normalizarTexto(valor);
  if (sexoNormalizado.startsWith('m')) return 'M';
  if (sexoNormalizado.startsWith('f')) return 'F';
  return '';
};

const AguardandoRegulacaoPanel = ({ filtros, sortConfig }) => {
  const [setores, setSetores] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [modalRegularAberto, setModalRegularAberto] = useState(false);
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [pacienteAlta, setPacienteAlta] = useState(null);
  const [altaDialogOpen, setAltaDialogOpen] = useState(false);
  const [processandoAlta, setProcessandoAlta] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { infeccoes } = useDadosHospitalares();

  const infeccoesMap = useMemo(() => {
    return new Map((infeccoes || []).map((infeccao) => [infeccao.id, infeccao]));
  }, [infeccoes]);

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
      // Filtrar pacientes que não estão em regulação ativa
      const pacientesSemRegulacao = pacientesData.filter(p => !p.regulacaoAtiva);
      setPacientes(pacientesSemRegulacao);
    });

    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeitos(leitosData);
    });

    return () => {
      unsubscribeSetores();
      unsubscribePacientes();
      unsubscribeLeitos();
    };
  }, []);

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

  const parseData = (valor) => {
    if (!valor) return null;

    let dataObj;

    if (typeof valor === 'string' && valor.includes('/')) {
      const partes = valor.split(' ');
      const [dia, mes, ano] = partes[0].split('/');

      if (partes.length > 1 && partes[1].includes(':')) {
        const [hora, minuto] = partes[1].split(':');
        dataObj = new Date(
          parseInt(ano, 10),
          parseInt(mes, 10) - 1,
          parseInt(dia, 10),
          parseInt(hora, 10),
          parseInt(minuto, 10)
        );
      } else {
        dataObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
      }
    } else if (valor && typeof valor.toDate === 'function') {
      dataObj = valor.toDate();
    } else {
      dataObj = new Date(valor);
    }

    if (isNaN(dataObj?.getTime?.())) {
      return null;
    }

    return dataObj;
  };

  const calcularTempoInternacaoHoras = (dataInternacao) => {
    const dataObj = parseData(dataInternacao);
    if (!dataObj) return null;
    const diffMs = Date.now() - dataObj.getTime();
    return diffMs / (1000 * 60 * 60);
  };

  const calcularTempoInternacao = (dataInternacao) => {
    const dataObj = parseData(dataInternacao);
    if (!dataObj) return '';

    const agora = new Date();
    const duracao = intervalToDuration({ start: dataObj, end: agora });

    if (duracao.days > 0) {
      return `${duracao.days}d ${duracao.hours || 0}h`;
    }
    if (duracao.hours > 0) {
      return `${duracao.hours}h ${duracao.minutes || 0}m`;
    }
    return `${duracao.minutes || 0}m`;
  };

  const pacientesFiltradosOrdenados = useMemo(() => {
    const {
      searchTerm = '',
      especialidade = 'todos',
      sexo = 'todos',
      idadeMin = '',
      idadeMax = '',
      tempoInternacaoMin = '',
      tempoInternacaoMax = '',
      unidadeTempo = 'dias'
    } = filtros || {};

    const termoBuscaNormalizado = normalizarTexto(searchTerm);
    const especialidadeFiltro = normalizarTexto(especialidade);
    const sexoFiltro = sexo || 'todos';
    const idadeMinNumero = idadeMin !== '' ? Number(idadeMin) : null;
    const idadeMaxNumero = idadeMax !== '' ? Number(idadeMax) : null;
    const tempoMinNumero = tempoInternacaoMin !== '' ? Number(tempoInternacaoMin) : null;
    const tempoMaxNumero = tempoInternacaoMax !== '' ? Number(tempoInternacaoMax) : null;

    const filtered = pacientes.filter((paciente) => {
      if (!paciente) return false;

      if (termoBuscaNormalizado) {
        const nomeNormalizado = normalizarTexto(paciente.nomePaciente);
        if (!nomeNormalizado.includes(termoBuscaNormalizado)) {
          return false;
        }
      }

      if (especialidadeFiltro && especialidadeFiltro !== 'todos') {
        const especialidadePaciente = normalizarTexto(paciente.especialidade);
        if (!especialidadePaciente.includes(especialidadeFiltro)) {
          return false;
        }
      }

      if (sexoFiltro && sexoFiltro !== 'todos') {
        if (normalizarSexo(paciente.sexo) !== sexoFiltro) {
          return false;
        }
      }

      const idade = calcularIdade(paciente.dataNascimento);
      if (idadeMinNumero !== null && idade < idadeMinNumero) {
        return false;
      }
      if (idadeMaxNumero !== null && idade > idadeMaxNumero) {
        return false;
      }

      const tempoHoras = calcularTempoInternacaoHoras(paciente.dataInternacao);
      const tempoMinHoras =
        tempoMinNumero !== null
          ? unidadeTempo === 'dias'
            ? tempoMinNumero * 24
            : tempoMinNumero
          : null;
      const tempoMaxHoras =
        tempoMaxNumero !== null
          ? unidadeTempo === 'dias'
            ? tempoMaxNumero * 24
            : tempoMaxNumero
          : null;

      if (tempoMinHoras !== null) {
        if (tempoHoras === null || tempoHoras < tempoMinHoras) {
          return false;
        }
      }

      if (tempoMaxHoras !== null) {
        if (tempoHoras === null || tempoHoras > tempoMaxHoras) {
          return false;
        }
      }

      return true;
    });

    const direction = sortConfig?.direction === 'desc' ? -1 : 1;
    const key = sortConfig?.key || 'nome';

    return filtered.sort((a, b) => {
      if (key === 'idade') {
        const idadeA = calcularIdade(a.dataNascimento);
        const idadeB = calcularIdade(b.dataNascimento);
        return direction * (idadeA - idadeB);
      }

      if (key === 'tempoInternacao') {
        const tempoA = calcularTempoInternacaoHoras(a.dataInternacao);
        const tempoB = calcularTempoInternacaoHoras(b.dataInternacao);
        const valorA =
          tempoA ?? (direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        const valorB =
          tempoB ?? (direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        return direction * (valorA - valorB);
      }

      const nomeA = normalizarTexto(a.nomePaciente);
      const nomeB = normalizarTexto(b.nomePaciente);
      return direction * nomeA.localeCompare(nomeB);
    });
  }, [pacientes, filtros, sortConfig]);

  // Filtrar pacientes pelos setores específicos
  const setoresRegulacao = ["PS DECISÃO CLINICA", "PS DECISÃO CIRURGICA", "CC - RECUPERAÇÃO"];

  const pacientesPorSetor = useMemo(() => {
    return setoresRegulacao.reduce((acc, nomeSetorAlvo) => {
      const setorAlvo = setores.find(s => s.nomeSetor === nomeSetorAlvo);

      if (!setorAlvo) {
        acc[nomeSetorAlvo] = [];
        return acc;
      }

      acc[nomeSetorAlvo] = pacientesFiltradosOrdenados.filter(
        (paciente) => paciente.setorId === setorAlvo.id
      );

      return acc;
    }, {});
  }, [pacientesFiltradosOrdenados, setores]);

  // Handlers para os modais
  const handleIniciarRegulacao = (paciente) => {
    setPacienteSelecionado(paciente);
    setModalRegularAberto(true);
  };

  const handleSolicitarAlta = (paciente) => {
    setPacienteAlta(paciente);
    setAltaDialogOpen(true);
  };

  const fecharDialogAlta = () => {
    setAltaDialogOpen(false);
    setPacienteAlta(null);
    setProcessandoAlta(false);
  };

  const handleConfirmarAlta = async () => {
    if (!pacienteAlta) return;

    setProcessandoAlta(true);

    try {
      const batch = writeBatch(db);
      const pacienteRef = doc(getPacientesCollection(), pacienteAlta.id);
      batch.delete(pacienteRef);

      let descricaoLeito = 'leito atual';

      if (pacienteAlta.leitoId) {
        const leitoAtual = leitos.find((leito) => leito.id === pacienteAlta.leitoId);
        const setorAtual = leitoAtual ? setores.find((setor) => setor.id === leitoAtual.setorId) : null;
        const leitoRef = doc(getLeitosCollection(), pacienteAlta.leitoId);

        descricaoLeito = [
          setorAtual?.siglaSetor || setorAtual?.nomeSetor,
          leitoAtual?.codigoLeito || leitoAtual?.codigo || pacienteAlta.codigoLeito || pacienteAlta.leitoId
        ]
          .filter(Boolean)
          .join(' - ') || 'leito atual';

        batch.update(leitoRef, {
          status: 'Higienização',
          statusLeito: 'Higienização',
          pacienteId: deleteField(),
          pacienteNome: deleteField(),
          historico: arrayUnion({
            status: 'Higienização',
            timestamp: new Date(),
            origem: 'Alta Direta'
          })
        });
      }

      await batch.commit();

      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      await logAction(
        'Alta Direta',
        `Alta direta registrada para o paciente '${pacienteAlta.nomePaciente}'. Leito ${descricaoLeito} encaminhado para higienização por ${nomeUsuario}.`,
        currentUser
      );

      toast({
        title: 'Alta registrada',
        description: `Paciente ${pacienteAlta.nomePaciente} removido e leito encaminhado para higienização.`,
      });

      fecharDialogAlta();
    } catch (error) {
      console.error('Erro ao registrar alta direta:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar a alta direta. Tente novamente.',
        variant: 'destructive',
      });
      setProcessandoAlta(false);
    }
  };

  const fecharModais = () => {
    setModalRegularAberto(false);
    setPacienteSelecionado(null);
  };

  const PacienteCard = ({ paciente, setor }) => {
    const idade = calcularIdade(paciente.dataNascimento);
    const sexoNormalizado = (paciente.sexo || '').trim().toUpperCase();
    const sexoSigla = sexoNormalizado === 'M' || sexoNormalizado === 'MASCULINO' ? 'M' : 'F';
    const tempoInternacao = calcularTempoInternacao(paciente.dataInternacao);
    const mostrarTempo = setor === "PS DECISÃO CLINICA" || setor === "PS DECISÃO CIRURGICA";
    const isolamentosAtivos = extrairIsolamentosAtivos(paciente.isolamentos);

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

          {isolamentosAtivos.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {isolamentosAtivos.map((iso, index) => {
                const infeccao =
                  typeof iso === 'object' && iso?.infeccaoId
                    ? infeccoesMap.get(iso.infeccaoId)
                    : null;
                const badgeTexto =
                  typeof iso === 'string'
                    ? iso
                    : [
                        iso?.sigla,
                        iso?.siglaInfeccao,
                        infeccao?.siglaInfeccao,
                        infeccao?.sigla,
                        iso?.nome,
                        infeccao?.nomeInfeccao,
                      ].find((valor) => valor && String(valor).trim().length > 0) || 'Isolamento';

                return (
                  <Badge
                    key={`${paciente.id || paciente.nomePaciente || 'paciente'}-${
                      typeof badgeTexto === 'string' ? badgeTexto : 'iso'
                    }-${index}`}
                    variant="destructive"
                    className="text-xs flex items-center gap-1"
                  >
                    <Shield className="h-3 w-3" />
                    {badgeTexto}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    onClick={() => handleIniciarRegulacao(paciente)}
                  >
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
                  <button
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    onClick={() => handleSolicitarAlta(paciente)}
                  >
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

      <AlertDialog
        open={altaDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (processandoAlta) return;
            fecharDialogAlta();
          } else {
            setAltaDialogOpen(true);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alta Direta</AlertDialogTitle>
            <AlertDialogDescription>
              {pacienteAlta
                ? `Deseja realmente registrar a alta direta para ${pacienteAlta.nomePaciente}?`
                : 'Deseja registrar a alta direta para o paciente selecionado?'}
              {' '}O leito será liberado para higienização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processandoAlta}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarAlta} disabled={processandoAlta}>
              {processandoAlta ? 'Processando...' : 'Confirmar Alta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modais */}
      <RegularPacienteModal
        isOpen={modalRegularAberto}
        onClose={fecharModais}
        paciente={pacienteSelecionado}
        modo="enfermaria"
        infeccoes={infeccoes}
      />
    </Card>
  );
};

export default AguardandoRegulacaoPanel;