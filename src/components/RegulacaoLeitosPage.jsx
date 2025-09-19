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
import {
  getPacientesCollection,
  getLeitosCollection,
  getSetoresCollection,
  getQuartosCollection,
  onSnapshot
} from '@/lib/firebase';
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
import SelecionarPeriodoModal from './modals/SelecionarPeriodoModal';
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
  const [selecionarPeriodoOpen, setSelecionarPeriodoOpen] = useState(false);
  const [relatorioPlantao, setRelatorioPlantao] = useState(null);

  useEffect(() => {
    const unsubscribes = [];

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
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPacientes(pacientesData);
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

    return () => {
      unsubscribes.forEach(unsub => unsub && unsub());
    };
  }, []);

  const sugestoes = useMemo(() => {
    if (!leitos?.length || !setores?.length || !pacientes?.length) {
      return [];
    }

    // Utility functions
    const normalizarTexto = (valor) =>
      String(valor ?? '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toLowerCase();

    const normalizarSexo = (valor) => {
      const sexo = String(valor ?? '').trim().toUpperCase();
      if (sexo.startsWith('M')) return 'M';
      if (sexo.startsWith('F')) return 'F';
      return '';
    };

    const normalizarIsolamentos = (lista) => {
      if (!lista) return '';
      const valores = (Array.isArray(lista) ? lista : [lista])
        .map((item) => {
          if (!item) return '';
          if (typeof item === 'string' || typeof item === 'number') {
            return String(item).trim().toLowerCase();
          }
          const identificador =
            item.infecaoId ||
            item.infeccaoId ||
            item.id ||
            item.siglaInfeccao ||
            item.sigla ||
            item.codigo ||
            item.nome ||
            '';
          return String(identificador).trim().toLowerCase();
        })
        .filter(Boolean)
        .sort();
      return valores.join('|');
    };

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

    // Define universes of analysis
    const setoresOrigemElegiveis = new Set([
      'PS DECISÃO CLINICA',
      'PS DECISÃO CIRURGICA', 
      'CC - RECUPERAÇÃO'
    ]);

    const setoresEnfermariaElegiveis = new Set([
      'UNID. CIRURGICA',
      'UNID. CLINICA MEDICA',
      'UNID. JS ORTOPEDIA',
      'UNID. INT. GERAL - UIG',
      'UNID. ONCOLOGIA',
      'UNID. NEFROLOGIA TRANSPLANTE'
    ]);

    // Filter relevant patients
    const pacientesRelevantes = pacientes.filter((paciente) => {
      if (paciente?.regulacaoAtiva) return false;
      const setorOrigem = normalizarTexto(paciente?.setorOrigem || '');
      return Array.from(setoresOrigemElegiveis).some(setor => 
        normalizarTexto(setor) === setorOrigem
      );
    });

    if (!pacientesRelevantes.length) {
      return [];
    }

    // Maps for quick lookup
    const setoresPorId = new Map(setores.map((setor) => [setor.id, setor]));
    const leitosPorId = new Map(leitos.map((leito) => [leito.id, leito]));
    const quartosPorId = new Map((quartos || []).map((quarto) => [quarto.id, quarto]));
    const pacientesPorLeito = new Map();

    pacientes.forEach((paciente) => {
      if (paciente?.leitoId) {
        pacientesPorLeito.set(paciente.leitoId, paciente);
      }
    });

    // Filter available beds
    const leitosDisponiveis = leitos.filter((leito) => {
      const setor = setoresPorId.get(leito.setorId);
      if (!setor) return false;
      
      // Check if it's a ward sector
      const setorNome = normalizarTexto(setor.nomeSetor || setor.siglaSetor || '');
      const isEnfermaria = Array.from(setoresEnfermariaElegiveis).some(enfermaria =>
        normalizarTexto(enfermaria) === setorNome
      );
      if (!isEnfermaria) return false;

      // Check bed status
      const statusLeito = normalizarTexto(leito.status ?? leito.statusLeito);
      if (!['vago', 'higienizacao'].includes(statusLeito)) return false;

      // Check if bed has active regulations or reservations
      if (leito.regulacaoEmAndamento || leito.reservaExterna || leito.regulacaoReserva) {
        return false;
      }

      return true;
    });

    if (!leitosDisponiveis.length) {
      return [];
    }

    // Helper functions for room analysis
    const obterLeitosDoQuarto = (leito) => {
      if (!leito?.quartoId) return [];
      const quarto = quartosPorId.get(leito.quartoId);
      if (quarto && Array.isArray(quarto.leitosIds) && quarto.leitosIds.length > 0) {
        return quarto.leitosIds
          .map((leitoId) => leitosPorId.get(leitoId))
          .filter(Boolean);
      }
      return leitos.filter((item) => item.quartoId === leito.quartoId);
    };

    const obterOcupantesDoQuarto = (leito) =>
      obterLeitosDoQuarto(leito)
        .filter((outroLeito) => outroLeito.id !== leito.id)
        .map((outroLeito) => pacientesPorLeito.get(outroLeito.id))
        .filter(Boolean);

    const determinarSexoCompativel = (leito) => {
      const ocupantes = obterOcupantesDoQuarto(leito);
      if (!ocupantes.length) return 'AMBOS';
      
      const sexos = new Set(
        ocupantes
          .map((ocupante) => normalizarSexo(ocupante?.sexo))
          .filter(Boolean)
      );
      
      if (sexos.size === 1) {
        const [valor] = Array.from(sexos);
        return valor; // 'M' or 'F'
      }
      
      return 'AMBOS'; // Mixed room
    };

    const determinarIsolamentoExigido = (leito) => {
      const ocupantes = obterOcupantesDoQuarto(leito);
      if (!ocupantes.length) return '';

      const chaves = new Set();
      ocupantes.forEach((ocupante) => {
        const chave = normalizarIsolamentos(ocupante?.isolamentos) || '';
        chaves.add(chave);
      });

      if (chaves.size === 1) {
        const [valor] = Array.from(chaves);
        return valor || '';
      }

      return '__misto__'; // Mixed isolations - not eligible
    };

    // Priority ranking function
    const priorizarPacientes = (lista) => {
      return [...lista].sort((a, b) => {
        // 1st: Isolation (with isolation comes first)
        const aIsolamento = normalizarIsolamentos(a?.isolamentos) !== '';
        const bIsolamento = normalizarIsolamentos(b?.isolamentos) !== '';
        if (aIsolamento !== bIsolamento) {
          return aIsolamento ? -1 : 1;
        }

        // 2nd: Time hospitalized (longer time comes first)
        const tempoA = calcularTempoInternacaoHoras(a?.dataInternacao);
        const tempoB = calcularTempoInternacaoHoras(b?.dataInternacao);
        const tempoANum = Number.isFinite(tempoA) ? tempoA : -Infinity;
        const tempoBNum = Number.isFinite(tempoB) ? tempoB : -Infinity;

        if (tempoANum !== tempoBNum) {
          return tempoBNum - tempoANum;
        }

        // 3rd: Age (older comes first)
        const idadeA = calcularIdade(a?.dataNascimento);
        const idadeB = calcularIdade(b?.dataNascimento);
        return idadeB - idadeA;
      });
    };

    // Main matchmaking algorithm
    const sugestoesPorSetor = new Map();

    leitosDisponiveis.forEach((leito) => {
      const setor = setoresPorId.get(leito.setorId);
      if (!setor) return;

      // Analyze room cohort
      const sexoCompativel = determinarSexoCompativel(leito);
      const isolamentoExigido = determinarIsolamentoExigido(leito);

      // Skip beds with mixed isolations
      if (isolamentoExigido === '__misto__') {
        return;
      }

      // Filter eligible patients
      const pacientesElegiveis = pacientesRelevantes.filter((paciente) => {
        // PCP rules (origin sector)
        if (leito.isPCP) {
          const setorOrigem = normalizarTexto(paciente?.setorOrigem || '');
          if (normalizarTexto('CC - RECUPERAÇÃO') === setorOrigem) {
            return false;
          }
        }

        // PCP rules (profile)
        if (leito.isPCP) {
          const idade = calcularIdade(paciente?.dataNascimento);
          if (idade < 18 || idade > 60) {
            return false;
          }
          const chaveIsolamento = normalizarIsolamentos(paciente?.isolamentos);
          if (chaveIsolamento !== '') {
            return false;
          }
        }

        // Gender rule
        if (sexoCompativel !== 'AMBOS') {
          const sexoPaciente = normalizarSexo(paciente?.sexo);
          if (!sexoPaciente || sexoPaciente !== sexoCompativel) {
            return false;
          }
        }

        // Isolation rule
        const chaveIsolamentoPaciente = normalizarIsolamentos(paciente?.isolamentos);
        if (chaveIsolamentoPaciente !== isolamentoExigido) {
          return false;
        }

        return true;
      });

      if (!pacientesElegiveis.length) {
        return;
      }

      // Rank patients by priority
      const pacientesOrdenados = priorizarPacientes(pacientesElegiveis);

      // Create suggestion
      if (!sugestoesPorSetor.has(setor.id)) {
        sugestoesPorSetor.set(setor.id, {
          setorId: setor.id,
          setorNome: setor.nomeSetor || setor.siglaSetor || 'Setor sem nome',
          setorSigla: setor.siglaSetor || '',
          sugestoes: []
        });
      }

      const grupo = sugestoesPorSetor.get(setor.id);
      grupo.sugestoes.push({
        leito: {
          ...leito,
          siglaSetor: setor.siglaSetor || '',
          nomeSetor: setor.nomeSetor || ''
        },
        pacientesElegiveis: pacientesOrdenados
      });
    });

    // Return grouped suggestions sorted by sector name
    return Array.from(sugestoesPorSetor.values())
      .map((grupo) => ({
        ...grupo,
        sugestoes: grupo.sugestoes.sort((a, b) => {
          const codigoA = String(a.leito.codigoLeito || '');
          const codigoB = String(b.leito.codigoLeito || '');
          return codigoA.localeCompare(codigoB, 'pt-BR', { numeric: true });
        })
      }))
      .sort((a, b) => a.setorNome.localeCompare(b.setorNome, 'pt-BR'));
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
                onClick={() => setSelecionarPeriodoOpen(true)}
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
      <SelecionarPeriodoModal
        isOpen={selecionarPeriodoOpen}
        onClose={() => setSelecionarPeriodoOpen(false)}
        onConfirm={(periodo) => {
          setRelatorioPlantao(periodo);
          setSelecionarPeriodoOpen(false);
        }}
      />
      {relatorioPlantao && (
        <PassagemPlantaoModal
          isOpen={!!relatorioPlantao}
          onClose={() => setRelatorioPlantao(null)}
          periodo={relatorioPlantao}
        />
      )}
    </div>
  );
};

export default RegulacaoLeitosPage;
