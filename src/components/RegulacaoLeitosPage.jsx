import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Wrench,
  Stethoscope,
  DatabaseIcon,
  BookUser,
  Sparkles,
  PieChart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getLeitosCompativeis, getChaveIsolamentosAtivos } from "@/lib/compatibilidadeLeitos";
import {
  getPacientesCollection,
  getLeitosCollection,
  getSetoresCollection,
  getQuartosCollection,
  getInfeccoesCollection,
  onSnapshot,
  getDocs
} from '@/lib/firebase';
import { processarPaciente } from '@/lib/pacienteUtils';
import ImportarPacientesMVModal from './ImportarPacientesMVModal';
import AguardandoRegulacaoPanel from './AguardandoRegulacaoPanel';
import FilaEsperaUTIPanel from './FilaEsperaUTIPanel';
import TransferenciaExternaPanel from './TransferenciaExternaPanel';
import RegulacoesEmAndamentoPanel from './RegulacoesEmAndamentoPanel';
import RemanejamentosPendentesPanel from './RemanejamentosPendentesPanel';
import FiltrosRegulacao from './FiltrosRegulacao';
import PanoramaDatePickerModal from './modals/PanoramaDatePickerModal';
import PanoramaRegulacoesModal from './modals/PanoramaRegulacoesModal';
import SugestoesRegulacaoModal from './modals/SugestoesRegulacaoModal';
import RegularPacienteModal from './modals/RegularPacienteModal';
import PassagemPlantaoModal from './modals/PassagemPlantaoModal';

const filtrosIniciais = {
  searchTerm: '',
  especialidade: 'todos',
  sexo: 'todos',
  idadeMin: '',
  idadeMax: '',
  tempoInternacaoMin: '',
  tempoInternacaoMax: '',
  unidadeTempo: 'dias'
};

const sortConfigInicial = { key: 'nome', direction: 'asc' };

const RegulacaoLeitosPage = () => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [sortConfig, setSortConfig] = useState(sortConfigInicial);
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
  const [periodoRelatorio, setPeriodoRelatorio] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [quartos, setQuartos] = useState([]);
  const [isSugestoesModalOpen, setSugestoesModalOpen] = useState(false);
  const [regularModalAberto, setRegularModalAberto] = useState(false);
  const [pacienteSugestao, setPacienteSugestao] = useState(null);
  const [leitoSugestao, setLeitoSugestao] = useState(null);
  const [isPassagemPlantaoOpen, setPassagemPlantaoOpen] = useState(false);

  useEffect(() => {
    const unsubscribes = [];
    const infeccoesMap = new Map();
    let ativo = true;

    const buscarInfeccoes = async () => {
      try {
        const snapshot = await getDocs(getInfeccoesCollection());
        snapshot.forEach((docSnapshot) => {
          infeccoesMap.set(docSnapshot.id, { id: docSnapshot.id, ...docSnapshot.data() });
        });
      } catch (error) {
        console.error("Erro ao carregar o cache de infecções:", error);
      }
    };

    const carregarDados = async () => {
      await buscarInfeccoes();

      const unsubSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
        const setoresData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSetores(setoresData);
      });
      unsubscribes.push(unsubSetores);

      const unsubLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
        const leitosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setLeitos(leitosData);
      });
      unsubscribes.push(unsubLeitos);

      const unsubPacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
        (async () => {
          const pacientesData = await Promise.all(
            snapshot.docs.map(doc =>
              processarPaciente(
                {
                  id: doc.id,
                  ...doc.data()
                },
                infeccoesMap
              )
            )
          );

          if (!ativo) return;

          setPacientes(pacientesData.filter(Boolean));
        })();
      });
      unsubscribes.push(unsubPacientes);

      const unsubQuartos = onSnapshot(getQuartosCollection(), (snapshot) => {
        const quartosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setQuartos(quartosData);
      });
      unsubscribes.push(unsubQuartos);
    };

    carregarDados();

    return () => {
      ativo = false;
      unsubscribes.forEach(unsub => unsub && unsub());
    };
  }, []);

  const sugestoes = useMemo(() => {
    if (!leitos?.length || !setores?.length || !pacientes?.length) {
      return [];
    }

    const normalizarTexto = (valor) =>
      String(valor ?? '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toLowerCase();

    const parseData = (valor) => {
      if (!valor) return null;
      if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return valor;
      }
      if (typeof valor === 'string' && valor.includes('/')) {
        const [dataParte, horaParte] = valor.split(' ');
        const [dia, mes, ano] = dataParte.split('/').map((parte) => parseInt(parte, 10));
        if (!Number.isFinite(dia) || !Number.isFinite(mes) || !Number.isFinite(ano)) {
          return null;
        }
        if (horaParte && horaParte.includes(':')) {
          const [hora, minuto] = horaParte.split(':').map((parte) => parseInt(parte, 10));
          return new Date(ano, mes - 1, dia, hora || 0, minuto || 0);
        }
        return new Date(ano, mes - 1, dia);
      }
      if (valor && typeof valor.toDate === 'function') {
        const data = valor.toDate();
        if (!Number.isNaN(data?.getTime?.())) {
          return data;
        }
      }
      const data = new Date(valor);
      return Number.isNaN(data?.getTime?.()) ? null : data;
    };

    const calcularIdade = (dataNascimento) => {
      const data = parseData(dataNascimento);
      if (!data) return 0;
      const hoje = new Date();
      let idade = hoje.getFullYear() - data.getFullYear();
      const mes = hoje.getMonth() - data.getMonth();
      if (mes < 0 || (mes === 0 && hoje.getDate() < data.getDate())) {
        idade -= 1;
      }
      return idade;
    };

    const calcularTempoInternacaoHoras = (dataInternacao) => {
      const data = parseData(dataInternacao);
      if (!data) return null;
      const diff = Date.now() - data.getTime();
      if (!Number.isFinite(diff)) return null;
      return diff / (1000 * 60 * 60);
    };

    const priorizarPacientes = (lista) => {
      return [...lista].sort((a, b) => {
        const aIsolamento = getChaveIsolamentosAtivos(a?.isolamentos) !== '';
        const bIsolamento = getChaveIsolamentosAtivos(b?.isolamentos) !== '';
        if (aIsolamento !== bIsolamento) {
          return aIsolamento ? -1 : 1;
        }

        const tempoA = calcularTempoInternacaoHoras(a?.dataInternacao);
        const tempoB = calcularTempoInternacaoHoras(b?.dataInternacao);
        const tempoANum = Number.isFinite(tempoA) ? tempoA : -Infinity;
        const tempoBNum = Number.isFinite(tempoB) ? tempoB : -Infinity;

        if (tempoANum !== tempoBNum) {
          return tempoBNum - tempoANum;
        }

        const idadeA = calcularIdade(a?.dataNascimento);
        const idadeB = calcularIdade(b?.dataNascimento);
        return idadeB - idadeA;
      });
    };

    const setoresOrigemElegiveis = new Set(
      ['PS DECISÃO CLINICA', 'PS DECISÃO CIRURGICA', 'CC - RECUPERAÇÃO']
        .map((nome) => normalizarTexto(nome))
    );

    const setoresEnfermariaElegiveis = new Set(
      [
        'UNID. CIRURGICA',
        'UNID. CLINICA MEDICA',
        'UNID. JS ORTOPEDIA',
        'UNID. INT. GERAL - UIG',
        'UNID. ONCOLOGIA',
        'UNID. NEFROLOGIA TRANSPLANTE'
      ].map((nome) => normalizarTexto(nome))
    );

    const pacientesRelevantes = pacientes.filter((paciente) => {
      if (paciente?.regulacaoAtiva) return false;
      const setorOrigem = normalizarTexto(paciente?.setorOrigem || '');
      return setoresOrigemElegiveis.has(setorOrigem);
    });

    if (!pacientesRelevantes.length) {
      return [];
    }

    const setoresPorId = new Map(setores.map((setor) => [setor.id, setor]));
    const setoresDestinoIds = new Set(
      setores
        .filter((setor) => {
          const nomeNormalizado = normalizarTexto(setor.nomeSetor || setor.siglaSetor || '');
          return setoresEnfermariaElegiveis.has(nomeNormalizado);
        })
        .map((setor) => String(setor.id))
    );

    if (!setoresDestinoIds.size) {
      return [];
    }

    const opcoesCompatibilidade = {
      setores,
      quartos,
      tiposSetorPermitidos: ['enfermaria'],
      setoresPermitidos: setoresDestinoIds,
    };

    const sugestoesPorLeito = new Map();

    pacientesRelevantes.forEach((pacienteAtual) => {
      const leitosCompativeis = getLeitosCompativeis(
        pacienteAtual,
        leitos,
        pacientes,
        opcoesCompatibilidade
      );

      leitosCompativeis.forEach((leitoAtual) => {
        if (!leitoAtual?.id) return;
        if (!sugestoesPorLeito.has(leitoAtual.id)) {
          sugestoesPorLeito.set(leitoAtual.id, {
            leito: leitoAtual,
            pacientes: [],
          });
        }
        sugestoesPorLeito.get(leitoAtual.id).pacientes.push(pacienteAtual);
      });
    });

    if (!sugestoesPorLeito.size) {
      return [];
    }

    const sugestoesPorSetor = new Map();

    sugestoesPorLeito.forEach(({ leito: leitoAtual, pacientes: pacientesElegiveis }) => {
      if (!pacientesElegiveis.length) return;

      const setor = setoresPorId.get(leitoAtual.setorId);
      if (!setor) return;

      if (!sugestoesPorSetor.has(setor.id)) {
        sugestoesPorSetor.set(setor.id, {
          setorId: setor.id,
          setorNome: setor.nomeSetor || setor.siglaSetor || 'Setor sem nome',
          setorSigla: setor.siglaSetor || '',
          sugestoes: [],
        });
      }

      const grupo = sugestoesPorSetor.get(setor.id);
      grupo.sugestoes.push({
        leito: {
          ...leitoAtual,
          siglaSetor: setor.siglaSetor || '',
          nomeSetor: setor.nomeSetor || '',
        },
        pacientesElegiveis: priorizarPacientes(pacientesElegiveis),
      });
    });

    if (!sugestoesPorSetor.size) {
      return [];
    }

    return Array.from(sugestoesPorSetor.values())
      .map((grupo) => ({
        ...grupo,
        sugestoes: grupo.sugestoes.sort((a, b) => {
          const codigoA = String(a.leito.codigoLeito || '');
          const codigoB = String(b.leito.codigoLeito || '');
          return codigoA.localeCompare(codigoB, 'pt-BR', { numeric: true, sensitivity: 'base' });
        }),
      }))
      .sort((a, b) => a.setorNome.localeCompare(b.setorNome, 'pt-BR', { sensitivity: 'base' }));
  }, [leitos, setores, pacientes, quartos]);

  const temSugestoes = sugestoes.length > 0;

  const handleSelecionarSugestao = (leito, paciente) => {
    if (!leito || !paciente) return;
    setLeitoSugestao(leito);
    setPacienteSugestao(paciente);
    setSugestoesModalOpen(false);
    setRegularModalAberto(true);
  };

  const handleFecharRegularModal = () => {
    setRegularModalAberto(false);
    setLeitoSugestao(null);
    setPacienteSugestao(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Seção 1: Cabeçalho do Dashboard */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: Indicadores Principais */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Indicadores Principais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Métricas e KPIs serão exibidos aqui.
            </p>
          </CardContent>
        </Card>

        {/* Coluna 2: Caixa de Ferramentas */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Caixa de Ferramentas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setShowImportModal(true)}
              >
                <DatabaseIcon className="h-4 w-4" />
                Importar Pacientes MV
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setPassagemPlantaoOpen(true)}
              >
                <BookUser className="h-4 w-4" />
                Passagem de Plantão
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "flex items-center gap-2 relative",
                  temSugestoes ? "sugestoes-disponiveis" : "opacity-60 cursor-not-allowed"
                )}
                disabled={!temSugestoes}
                onClick={() => temSugestoes && setSugestoesModalOpen(true)}
              >
                {temSugestoes && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white notificacao-sugestao" />
                )}
                <Sparkles className="h-4 w-4" />
                Sugestões de Regulação
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setDatePickerOpen(true)}
              >
                <PieChart className="h-4 w-4" />
                Panorama de Regulações
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Seção 2: Filtros */}
      <section>
        <FiltrosRegulacao
          filtros={filtros}
          setFiltros={setFiltros}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
          initialFilters={filtrosIniciais}
          defaultSortConfig={sortConfigInicial}
        />
      </section>

      {/* Seção 3: Painel Principal de Regulação */}
      <section>
        <div className="space-y-6">
          {/* Painel de Pacientes Aguardando Regulação */}
          <AguardandoRegulacaoPanel filtros={filtros} sortConfig={sortConfig} />

          {/* Linha: Fila UTI + Transferência Externa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FilaEsperaUTIPanel filtros={filtros} sortConfig={sortConfig} />
            <TransferenciaExternaPanel filtros={filtros} sortConfig={sortConfig} />
          </div>

          {/* Painel de Remanejamentos Pendentes */}
          <RemanejamentosPendentesPanel filtros={filtros} sortConfig={sortConfig} />

          {/* Painel de Regulações em Andamento */}
          <RegulacoesEmAndamentoPanel filtros={filtros} sortConfig={sortConfig} />

          {/* Outros Cards em Grid - ÚLTIMO ITEM */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Card: Marcação Cirúrgica */}
            <Card className="shadow-card card-interactive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                  Marcações Cirúrgicas Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Os dados serão carregados e exibidos aqui.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Modal de Importação */}
      <SugestoesRegulacaoModal
        isOpen={isSugestoesModalOpen}
        onClose={() => setSugestoesModalOpen(false)}
        sugestoes={sugestoes}
      />
      <RegularPacienteModal
        isOpen={regularModalAberto}
        onClose={handleFecharRegularModal}
        paciente={pacienteSugestao}
        modo="enfermaria"
        leitoSugerido={leitoSugestao}
      />
      <ImportarPacientesMVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
      <PanoramaDatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onConfirmarPeriodo={(periodo) => {
          setPeriodoRelatorio(periodo);
          setDatePickerOpen(false);
        }}
      />
      {periodoRelatorio && (
        <PanoramaRegulacoesModal
          isOpen={!!periodoRelatorio}
          onClose={() => setPeriodoRelatorio(null)}
          periodo={periodoRelatorio}
        />
      )}
      <PassagemPlantaoModal
        isOpen={isPassagemPlantaoOpen}
        onClose={() => setPassagemPlantaoOpen(false)}
      />
    </div>
  );
};

export default RegulacaoLeitosPage;
