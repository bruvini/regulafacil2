import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowRightLeft, Clock, MapPin } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getPacientesCollection,
  getLeitosCollection,
  getSetoresCollection,
  getInfeccoesCollection,
  onSnapshot,
  doc,
  updateDoc,
  deleteField
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import RegularPacienteModal from './modals/RegularPacienteModal';

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

const RemanejamentosPendentesPanel = ({ filtros, sortConfig }) => {
  const [pacientes, setPacientes] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [infeccoes, setInfeccoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para modais
  const [modalRegular, setModalRegular] = useState({
    isOpen: false,
    paciente: null,
    modoRemanejamento: null,
  });
  const [modalCancelar, setModalCancelar] = useState({ isOpen: false, paciente: null });
  
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // Buscar dados em tempo real
  useEffect(() => {
    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPacientes(pacientesData);
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
      setLoading(false);
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
      unsubscribeLeitos();
      unsubscribeSetores();
      unsubscribeInfeccoes();
    };
  }, []);

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

  const pacientesFiltradosOrdenados = useMemo(() => {
    const base = pacientes.filter(p => p.pedidoRemanejamento && !p.regulacaoAtiva);

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

    const filtrados = base.filter((paciente) => {
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

    return filtrados.sort((a, b) => {
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

  const remanejamentosAgrupados = useMemo(() => {
    const grupos = {};
    pacientesFiltradosOrdenados.forEach(paciente => {
      const tipo = paciente.pedidoRemanejamento.tipo;
      if (!grupos[tipo]) {
        grupos[tipo] = [];
      }
      grupos[tipo].push(paciente);
    });
    return grupos;
  }, [pacientesFiltradosOrdenados]);

  // Função para obter informações do leito atual do paciente
  const obterLocalizacaoAtual = (paciente) => {
    const leito = leitos.find(l => l.id === paciente.leitoId);
    if (!leito) return { setor: 'N/A', leito: 'N/A' };
    
    const setor = setores.find(s => s.id === leito.setorId);
    return {
      setor: setor?.siglaSetor || 'N/A',
      leito: leito.codigoLeito || 'N/A'
    };
  };

  // Função para calcular tempo desde a solicitação
  const calcularTempoSolicitacao = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    let data;
    if (timestamp && typeof timestamp.toDate === 'function') {
      data = timestamp.toDate();
    } else {
      data = new Date(timestamp);
    }
    
    if (isNaN(data.getTime())) return 'N/A';
    
    return formatDistanceToNow(data, { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  // Ação para cancelar remanejamento
  const handleCancelarRemanejamento = async (paciente) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      await updateDoc(pacienteRef, {
        pedidoRemanejamento: deleteField()
      });

      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      await logAction(
        'Regulação de Leitos',
        `Pedido de remanejamento para o paciente '${paciente.nomePaciente}' foi cancelado por ${nomeUsuario}.`,
        currentUser
      );

      toast({
        title: "Remanejamento cancelado",
        description: `Pedido de remanejamento do paciente ${paciente.nomePaciente} foi cancelado.`,
      });

      setModalCancelar({ isOpen: false, paciente: null });
    } catch (error) {
      console.error('Erro ao cancelar remanejamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao cancelar o remanejamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Ação para iniciar regulação
  const handleRemanejarPaciente = (paciente) => {
    const tipoRemanejamento = paciente?.pedidoRemanejamento?.tipo;
    const modoRemanejamento = tipoRemanejamento === 'Contra Fluxo' ? 'contraFluxo' : null;

    setModalRegular({ isOpen: true, paciente, modoRemanejamento });
  };

  // Componente do card do paciente
  const PacienteRemanejamentoCard = ({ paciente }) => {
    const localizacao = obterLocalizacaoAtual(paciente);
    const tempoSolicitacao = calcularTempoSolicitacao(paciente.pedidoRemanejamento.timestamp);
    const isCancelavel = paciente.pedidoRemanejamento?.tipo !== 'Risco de Contaminação Cruzada';

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
            <Badge variant="outline" className="text-xs font-medium bg-blue-100 text-blue-800 border-blue-300">
              <ArrowRightLeft className="h-3 w-3 mr-1" />
              Pendente
            </Badge>
          </div>

          {/* Localização Atual */}
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="font-medium">Localização Atual: </span>
            <span className="font-semibold">{localizacao.setor} - {localizacao.leito}</span>
          </div>

          {/* Tempo de Solicitação */}
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="font-medium">Solicitado: </span>
            <span>{tempoSolicitacao}</span>
          </div>

          {/* Justificativa */}
          {(paciente.pedidoRemanejamento?.detalhe || paciente.pedidoRemanejamento?.descricao) && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Justificativa: </span>
              <span className="italic">
                {paciente.pedidoRemanejamento?.detalhe || paciente.pedidoRemanejamento?.descricao}
              </span>
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            {isCancelavel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setModalCancelar({ isOpen: true, paciente })}
              >
                Cancelar
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => handleRemanejarPaciente(paciente)}
            >
              Remanejar Paciente
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRightLeft className="h-5 w-5 text-teal-600" />
            Remanejamentos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
            <span>Carregando remanejamentos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRemanejamentos = pacientesFiltradosOrdenados.length;

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRightLeft className="h-5 w-5 text-teal-600" />
            Remanejamentos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalRemanejamentos === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Não há remanejamentos pendentes</p>
              <p className="text-xs mt-1">
                Solicitar um remanejamento através do menu de ações no Mapa de Leitos
              </p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {Object.entries(remanejamentosAgrupados).map(([tipo, pacientesGrupo]) => (
                <AccordionItem key={tipo} value={tipo}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tipo}</span>
                      <Badge variant="secondary" className="text-xs">
                        {pacientesGrupo.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                      {pacientesGrupo.map((paciente) => (
                        <PacienteRemanejamentoCard key={paciente.id} paciente={paciente} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Modal de Regulação */}
      {modalRegular.paciente && (
        <RegularPacienteModal
          isOpen={modalRegular.isOpen}
          onClose={() => setModalRegular({ isOpen: false, paciente: null, modoRemanejamento: null })}
          paciente={modalRegular.paciente}
          modo="remanejamento"
          infeccoes={infeccoes}
          modoRemanejamento={modalRegular.modoRemanejamento}
        />
      )}

      {/* Modal de Confirmação de Cancelamento */}
      <AlertDialog open={modalCancelar.isOpen} onOpenChange={(open) => setModalCancelar({ isOpen: open, paciente: open ? modalCancelar.paciente : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Remanejamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o pedido de remanejamento para o paciente{' '}
              <strong>{modalCancelar.paciente?.nomePaciente}</strong>?
              <br />
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleCancelarRemanejamento(modalCancelar.paciente)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RemanejamentosPendentesPanel;