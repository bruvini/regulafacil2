import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader, Copy, FileText, AlertTriangle, Check } from "lucide-react";
import { intervalToDuration, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getSetoresCollection,
  getLeitosCollection,
  getPacientesCollection,
  getInfeccoesCollection,
  onSnapshot,
  doc,
  updateDoc,
  deleteField,
  writeBatch,
  arrayUnion,
  serverTimestamp,
  db,
  getHistoricoRegulacoesCollection
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import ConcluirRegulacaoModal from './modals/ConcluirRegulacaoModal';
import CancelarRegulacaoModal from './modals/CancelarRegulacaoModal';
import AlterarRegulacaoModal from './modals/AlterarRegulacaoModal';
import ResumoRegulacoesModal from './modals/ResumoRegulacoesModal';
import { adicionarConclusaoRegulacaoAoBatch } from '@/lib/regulacao';

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

const RegulacoesEmAndamentoPanel = ({ filtros, sortConfig }) => {
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [infeccoes, setInfeccoes] = useState([]);
  const [regulacoes, setRegulacoes] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados dos modais
  const [modalConcluir, setModalConcluir] = useState({ open: false, paciente: null });
  const [modalCancelar, setModalCancelar] = useState({ open: false, paciente: null });
  const [modalAlterar, setModalAlterar] = useState({ isOpen: false, regulacao: null });
  const [isResumoModalOpen, setIsResumoModalOpen] = useState(false);

  const { toast } = useToast();
  const { currentUser } = useAuth();

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return 0;

    let dataObj;

    if (typeof dataNascimento === 'string' && dataNascimento.includes('/')) {
      const [dia, mes, ano] = dataNascimento.split('/');
      dataObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
    } else if (dataNascimento && typeof dataNascimento.toDate === 'function') {
      dataObj = dataNascimento.toDate();
    } else {
      dataObj = new Date(dataNascimento);
    }

    if (isNaN(dataObj?.getTime?.())) {
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

    const unsubscribeInfeccoes = onSnapshot(getInfeccoesCollection(), (snapshot) => {
      const infeccoesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInfeccoes(infeccoesData);
    });

    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPacientes(pacientesData);

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
      unsubscribeInfeccoes();
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
    if (!leitoId) {
      return {
        id: null,
        codigo: 'N/A',
        codigoLeito: 'N/A',
        siglaSetor: 'N/A',
        nomeSetor: 'Setor não informado',
        setorId: null,
        status: 'Indefinido',
      };
    }

    const leito = leitos.find((l) => l.id === leitoId);
    if (!leito) {
      return {
        id: leitoId,
        codigo: 'N/A',
        codigoLeito: 'N/A',
        siglaSetor: 'N/A',
        nomeSetor: 'Setor não informado',
        setorId: null,
        status: 'Indisponível',
      };
    }

    const setor = setores.find((s) => s.id === leito.setorId);

    return {
      id: leito.id,
      codigo: leito.codigoLeito || 'N/A',
      codigoLeito: leito.codigoLeito || 'N/A',
      siglaSetor: setor?.siglaSetor || leito.siglaSetor || 'N/A',
      nomeSetor: setor?.nomeSetor || leito.nomeSetor || 'Setor não informado',
      setorId: leito.setorId || setor?.id || null,
      status: leito.status || 'Indefinido',
      dadosCompletos: leito,
    };
  };

  const montarContextoAlteracao = (paciente) => {
    if (!paciente?.regulacaoAtiva) {
      return null;
    }

    return {
      paciente,
      leitoOrigem: obterInfoLeito(paciente.regulacaoAtiva.leitoOrigemId),
      leitoDestino: obterInfoLeito(paciente.regulacaoAtiva.leitoDestinoId),
    };
  };

  const abrirModalAlterar = (paciente) => {
    const contexto = montarContextoAlteracao(paciente);

    if (!contexto) {
      toast({
        title: 'Não foi possível abrir a alteração',
        description: 'Os dados da regulação ativa não foram encontrados para este paciente.',
        variant: 'destructive',
      });
      return;
    }

    setModalAlterar({ isOpen: true, regulacao: contexto });
  };

  // Função para copiar texto personalizado
  const handleCopiarTexto = async (paciente) => {
    const { regulacaoAtiva } = paciente;
    const leitoOrigem = obterInfoLeito(regulacaoAtiva.leitoOrigemId);
    const leitoDestino = obterInfoLeito(regulacaoAtiva.leitoDestinoId);

    // Mapear nomes das infecções (se disponíveis)
    const nomesInfeccoes = (paciente.isolamentos || [])
      .map((iso) => infeccoes.find((inf) => inf.id === iso.infecaoId)?.nomeInfeccao)
      .filter(Boolean)
      .join(', ');

    const observacoes = paciente.observacoesNIR || paciente.observacoes || '';
    
    let texto = `*REGULAÇÃO EM ANDAMENTO*\n\n` +
      `*Paciente:* _${paciente.nomePaciente}_\n` +
      `*De:* _${leitoOrigem.siglaSetor} - ${leitoOrigem.codigo}_\n` +
      `*Para:* _${leitoDestino.siglaSetor} - ${leitoDestino.codigo}_`;

    if (nomesInfeccoes) {
      texto += `\n*Isolamento:* _${nomesInfeccoes}_`;
    }
    if (observacoes.trim()) {
      texto += `\n*Observações NIR:* _${observacoes.trim()}_`;
    }

    let dataInicioFormatada = 'Data de início não informada';
    if (regulacaoAtiva?.iniciadoEm) {
      const dataInicio = typeof regulacaoAtiva.iniciadoEm.toDate === 'function'
        ? regulacaoAtiva.iniciadoEm.toDate()
        : new Date(regulacaoAtiva.iniciadoEm);

      if (!isNaN(dataInicio.getTime())) {
        dataInicioFormatada = format(dataInicio, 'dd/MM/yyyy HH:mm', { locale: ptBR });
      }
    }

    texto += `\n\n_Regulação iniciada em ${dataInicioFormatada}_`;

    try {
      await navigator.clipboard.writeText(texto);
      toast({
        title: "Texto copiado",
        description: "Informações da regulação copiadas para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o texto.",
        variant: "destructive",
      });
    }
  };

  const regulacoesFiltradas = useMemo(() => {
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

    const filtradas = regulacoes.filter((paciente) => {
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

    return filtradas.sort((a, b) => {
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
  }, [regulacoes, filtros, sortConfig]);

  // Função para concluir regulação
  const handleConcluirRegulacao = async (paciente) => {
    const { regulacaoAtiva } = paciente;
    const leitoOrigem = obterInfoLeito(regulacaoAtiva.leitoOrigemId);
    const leitoDestino = obterInfoLeito(regulacaoAtiva.leitoDestinoId);
    const leitoDestinoAtual = leitos.find((l) => l.id === regulacaoAtiva.leitoDestinoId);

    if (!leitoDestinoAtual) {
      toast({
        title: "Leito não encontrado",
        description: "Não foi possível localizar o leito de destino desta regulação.",
        variant: "destructive",
      });
      setModalConcluir({ open: false, paciente: null });
      return;
    }

    const leitoEstaOcupado = leitoDestinoAtual.status === 'Ocupado';
    const pacienteDiferente =
      leitoDestinoAtual.pacienteId && leitoDestinoAtual.pacienteId !== paciente.id;

    if (leitoEstaOcupado && pacienteDiferente) {
      const pacienteOcupante = pacientes.find((p) => p.id === leitoDestinoAtual.pacienteId);
      toast({
        title: "Conclusão bloqueada",
        description: `O leito ${leitoDestinoAtual.codigoLeito || 'destino'} está ocupado por ${pacienteOcupante?.nomePaciente || 'outro paciente'}. Altere a regulação antes de concluir.`,
        variant: "destructive",
      });
      setModalConcluir({ open: false, paciente: null });
      return;
    }

    try {
      const batch = writeBatch(db);
      const destinoSetorId = regulacaoAtiva.setorDestinoId || leitos.find(l => l.id === regulacaoAtiva.leitoDestinoId)?.setorId;
      const setorDestino = setores.find(s => s.id === destinoSetorId);

      const { logEntries } = adicionarConclusaoRegulacaoAoBatch({
        batch,
        paciente,
        currentUser,
        leitoOrigem,
        leitoDestino,
        setorDestino
      });

      await batch.commit();

      for (const message of logEntries) {
        await logAction('Regulação de Leitos', message, currentUser);
      }
      
      toast({
        title: "Regulação concluída",
        description: `Paciente ${paciente.nomePaciente} transferido com sucesso.`,
      });
      
      setModalConcluir({ open: false, paciente: null });
      
    } catch (error) {
      console.error('Erro ao concluir regulação:', error);
      toast({
        title: "Erro",
        description: "Erro ao concluir a regulação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Função para cancelar regulação
  const handleCancelarRegulacao = async (paciente, justificativa, mensagemCancelamento) => {
    const { regulacaoAtiva } = paciente;
    const leitoOrigem = obterInfoLeito(regulacaoAtiva.leitoOrigemId);
    const leitoDestino = obterInfoLeito(regulacaoAtiva.leitoDestinoId);

    try {
      const batch = writeBatch(db);
      const destinoSetorId = regulacaoAtiva.setorDestinoId || leitos.find(l => l.id === regulacaoAtiva.leitoDestinoId)?.setorId;
      const historicoRef = doc(getHistoricoRegulacoesCollection(), paciente.id);
      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      const justificativaTexto = justificativa?.trim?.() || justificativa;

      // 1. Atualizar documento do paciente
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      batch.update(pacienteRef, {
        regulacaoAtiva: deleteField()
      });
      
      // 2. Atualizar leito de origem
      const leitoOrigemRef = doc(getLeitosCollection(), regulacaoAtiva.leitoOrigemId);
      batch.update(leitoOrigemRef, {
        regulacaoEmAndamento: deleteField()
      });
      
      // 3. Atualizar leito de destino
      const leitoDestinoRef = doc(getLeitosCollection(), regulacaoAtiva.leitoDestinoId);
      batch.update(leitoDestinoRef, {
        regulacaoEmAndamento: deleteField(),
        status: 'Vago',
        historico: arrayUnion({
          status: 'Vago',
          timestamp: new Date()
        })
      });

      batch.set(
        historicoRef,
        {
          status: 'Cancelada',
          dataCancelamento: serverTimestamp(),
          userNameCancelamento: nomeUsuario,
          statusFinal: 'Cancelada',
          motivoCancelamento: justificativaTexto,
          mensagemCancelamento,
          leitoDestinoCanceladoId: regulacaoAtiva.leitoDestinoId,
          setorDestinoCanceladoId: destinoSetorId
        },
        { merge: true }
      );

      // Executar transação
      await batch.commit();

      // Copiar mensagem para área de transferência
      await navigator.clipboard.writeText(mensagemCancelamento);

      // Auditoria
      await logAction(
        'Regulação de Leitos',
        `Regulação para o paciente '${paciente.nomePaciente}' (do leito ${leitoOrigem.siglaSetor} - ${leitoOrigem.codigo} para ${leitoDestino.siglaSetor} - ${leitoDestino.codigo}) foi CANCELADA por ${nomeUsuario}. Motivo: '${justificativaTexto}'.`,
        currentUser
      );
      
      toast({
        title: "Regulação cancelada",
        description: "Regulação cancelada e mensagem copiada para área de transferência.",
      });
      
      setModalCancelar({ open: false, paciente: null });
      
    } catch (error) {
      console.error('Erro ao cancelar regulação:', error);
      toast({
        title: "Erro",
        description: "Erro ao cancelar a regulação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const RegulacaoListItem = ({ paciente }) => {
    const { regulacaoAtiva } = paciente;
    const leitoOrigem = obterInfoLeito(regulacaoAtiva.leitoOrigemId);
    const leitoDestino = obterInfoLeito(regulacaoAtiva.leitoDestinoId);
    const tempoRegulacao = calcularTempoRegulacao(regulacaoAtiva.iniciadoEm);
    const leitoDestinoAtual = leitos.find((l) => l.id === regulacaoAtiva.leitoDestinoId);
    const leitoEstaOcupado = leitoDestinoAtual?.status === 'Ocupado';
    const pacienteDiferente =
      leitoDestinoAtual?.pacienteId && leitoDestinoAtual.pacienteId !== paciente.id;
    const isConflito = Boolean(leitoEstaOcupado && pacienteDiferente);
    const pacienteOcupante = isConflito
      ? pacientes.find((p) => p.id === leitoDestinoAtual?.pacienteId)
      : null;

    return (
      <TooltipProvider>
        <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                {paciente.nomePaciente}
              </h4>
              <Badge variant="outline" className="border-orange-300 bg-orange-100 text-xs font-medium text-orange-800">
                Em Regulação
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div className="font-medium">
                DE:{' '}
                <span className="font-semibold text-foreground">{leitoOrigem.siglaSetor} - {leitoOrigem.codigo}</span>
              </div>
              <div className="font-medium">
                PARA:{' '}
                <span className="font-semibold text-foreground">{leitoDestino.siglaSetor} - {leitoDestino.codigo}</span>
              </div>
            </div>
            <div className="text-xs font-medium text-muted-foreground">{tempoRegulacao}</div>

            {isConflito && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <h4 className="font-semibold">Leito de Destino Ocupado!</h4>
                </div>
                <p className="mt-2 text-destructive/90">
                  O leito {leitoDestinoAtual?.codigoLeito || leitoDestino.codigo} está agora ocupado por
                  {' '}
                  <strong>{pacienteOcupante ? pacienteOcupante.nomePaciente : 'outro paciente'}</strong>.
                </p>
                <p className="mt-2 text-destructive/90">
                  Por favor, <strong>altere</strong> a regulação para um novo leito.
                </p>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:items-end">
            <div className="flex justify-end gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => handleCopiarTexto(paciente)}
                    aria-label="Copiar mensagem"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copiar mensagem</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalCancelar({ open: true, paciente })}
              >
                Cancelar
              </Button>
              <Button
                variant={isConflito ? "default" : "outline"}
                size="sm"
                onClick={() => abrirModalAlterar(paciente)}
              >
                {isConflito ? "Alterar (Obrigatório)" : "Alterar"}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`inline-flex ${isConflito ? 'cursor-not-allowed' : ''}`}>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setModalConcluir({ open: true, paciente })}
                      disabled={isConflito}
                      className="flex items-center"
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Concluir Regulação
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isConflito
                      ? 'Não é possível concluir. O leito de destino foi ocupado.'
                      : 'Concluir regulação'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {isConflito && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-xs text-muted-foreground">(Conclusão bloqueada)</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Não é possível concluir. O leito de destino foi ocupado.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </TooltipProvider>
    );
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex justify-between items-center w-full">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Loader className="h-5 w-5 text-orange-600" />
              Regulações em Andamento
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsResumoModalOpen(true)}
                    disabled={regulacoes.length === 0}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Resumo
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {regulacoes.length === 0 
                    ? "Nenhuma regulação em andamento" 
                    : "Ver resumo das regulações"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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
          ) : regulacoesFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma regulação corresponde aos filtros aplicados</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="divide-y divide-border">
                {regulacoesFiltradas.map((paciente) => (
                  <RegulacaoListItem key={paciente.id} paciente={paciente} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modais */}
      {modalConcluir.paciente && (
        <ConcluirRegulacaoModal
          open={modalConcluir.open}
          onOpenChange={(open) => setModalConcluir({ open, paciente: open ? modalConcluir.paciente : null })}
          paciente={modalConcluir.paciente}
          leitoOrigem={obterInfoLeito(modalConcluir.paciente.regulacaoAtiva.leitoOrigemId)}
          leitoDestino={obterInfoLeito(modalConcluir.paciente.regulacaoAtiva.leitoDestinoId)}
          onConfirmar={handleConcluirRegulacao}
        />
      )}

      {modalCancelar.paciente && (
        <CancelarRegulacaoModal
          open={modalCancelar.open}
          onOpenChange={(open) => setModalCancelar({ open, paciente: open ? modalCancelar.paciente : null })}
          paciente={modalCancelar.paciente}
          leitoOrigem={obterInfoLeito(modalCancelar.paciente.regulacaoAtiva.leitoOrigemId)}
          leitoDestino={obterInfoLeito(modalCancelar.paciente.regulacaoAtiva.leitoDestinoId)}
          onConfirmar={handleCancelarRegulacao}
        />
      )}

      {modalAlterar.regulacao && (
        <AlterarRegulacaoModal
          isOpen={modalAlterar.isOpen}
          onClose={() => setModalAlterar({ isOpen: false, regulacao: null })}
          regulacao={modalAlterar.regulacao}
        />
      )}

      <ResumoRegulacoesModal
        isOpen={isResumoModalOpen}
        onClose={() => setIsResumoModalOpen(false)}
        regulacoes={regulacoes}
        leitos={leitos}
        setores={setores}
      />
    </>
  );
};

export default RegulacoesEmAndamentoPanel;