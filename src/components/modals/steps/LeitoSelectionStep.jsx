import React, { useMemo } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Bed, AlertCircle, Search } from "lucide-react";

// Helper para criar uma chave única e ordenada para os isolamentos de um paciente
const normalizarIsolamentos = (isolamentos) => {
  if (!Array.isArray(isolamentos) || isolamentos.length === 0) {
    return '';
  }

  return isolamentos
    .map((iso) => {
      if (!iso) return '';

      const identificador =
        iso.infeccaoId ??
        iso.infecaoId ??
        iso.id ??
        iso.siglaInfeccao ??
        iso.sigla ??
        iso.nomeInfeccao ??
        iso.nome;

      return identificador ? String(identificador).trim() : '';
    })
    .filter(Boolean)
    .sort()
    .join('|');
};

// Helper para obter o sexo normalizado (M/F)
const normalizarSexo = (sexo) => {
  if (!sexo || typeof sexo !== 'string') return '';
  const valor = sexo.trim().toUpperCase();
  if (valor.startsWith('M')) return 'M';
  if (valor.startsWith('F')) return 'F';
  return '';
};

const LeitoSelectionStep = ({ 
  dados, 
  paciente, 
  modo = 'enfermaria', 
  onLeitoSelect 
}) => {
  const [termoBusca, setTermoBusca] = React.useState('');
  // Função para calcular idade
  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return 0;
    
    let dataObj;
    
    if (typeof dataNascimento === 'string' && dataNascimento.includes('/')) {
      const [dia, mes, ano] = dataNascimento.split('/');
      dataObj = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    } else if (dataNascimento && typeof dataNascimento.toDate === 'function') {
      dataObj = dataNascimento.toDate();
    } else {
      dataObj = new Date(dataNascimento);
    }
    
    if (isNaN(dataObj.getTime())) return 0;
    
    const hoje = new Date();
    let idade = hoje.getFullYear() - dataObj.getFullYear();
    const m = hoje.getMonth() - dataObj.getMonth();
    
    if (m < 0 || (m === 0 && hoje.getDate() < dataObj.getDate())) {
      idade--;
    }
    
    return idade;
  };

  // Motor de Regras - Filtragem de Leitos Compatíveis (refatorado)
  const getLeitosCompatíveis = (paciente, todosOsDados, modo = 'enfermaria') => {
    if (!paciente || !todosOsDados) return [];

    const {
      leitos = [],
      setores = [],
      pacientes: pacientesExistentes = []
    } = todosOsDados;

    const normalizarTipoSetor = (tipo) =>
      (typeof tipo === 'string' ? tipo.trim().toUpperCase() : '');

    const normalizarStatus = (status) =>
      (typeof status === 'string' ? status.trim().toLowerCase() : '');

    const statusElegiveis = new Set(['vago', 'higienização', 'higienizacao']);

    // --- MODO UTI (Lógica Simples e Direta) ---
    if (modo === 'uti') {
      return leitos.filter((leito) => {
        const setor = setores.find((s) => s.id === leito.setorId);
        const tipoSetor = normalizarTipoSetor(setor?.tipoSetor);
        const statusLeito = normalizarStatus(leito?.status ?? leito?.statusLeito);

        return (
          tipoSetor === 'UTI' &&
          statusElegiveis.has(statusLeito) &&
          !leito.regulacaoEmAndamento &&
          !leito.reservaExterna &&
          !leito.regulacaoReserva
        );
      });
    }

    // --- MODO ENFERMARIA (Lógica Complexa e Detalhada) ---

    // 1. Pré-processamento e Cache de Dados para Performance
    const pacientesPorLeitoId = new Map(
      pacientesExistentes
        .filter((pacienteExistente) => pacienteExistente?.leitoId)
        .map((pacienteExistente) => [pacienteExistente.leitoId, pacienteExistente])
    );

    const leitosPorQuartoId = new Map();
    for (const leitoAtual of leitos) {
      if (!leitoAtual?.quartoId) continue;
      if (!leitosPorQuartoId.has(leitoAtual.quartoId)) {
        leitosPorQuartoId.set(leitoAtual.quartoId, []);
      }
      leitosPorQuartoId.get(leitoAtual.quartoId).push(leitoAtual);
    }

    // 2. Pré-filtragem de Leitos Candidatos
    const candidatos = leitos.filter((leito) => {
      const setor = setores.find((s) => s.id === leito.setorId);
      const tipoSetor = normalizarTipoSetor(setor?.tipoSetor);
      const statusLeito = normalizarStatus(leito?.status ?? leito?.statusLeito);

      return (
        tipoSetor === 'ENFERMARIA' &&
        statusElegiveis.has(statusLeito) &&
        !leito.regulacaoEmAndamento &&
        !leito.reservaExterna &&
        !leito.regulacaoReserva
      );
    });

    const compativeis = [];

    const sexoPacienteNormalizado = normalizarSexo(
      paciente?.sexo ?? paciente?.sexoPaciente
    );
    const isolamentosBrutosPaciente =
      paciente?.isolamentos ?? paciente?.isolamentosVigentes ?? [];
    const isolamentosPaciente = Array.isArray(isolamentosBrutosPaciente)
      ? isolamentosBrutosPaciente
      : [];
    const chaveIsolamentoPaciente = normalizarIsolamentos(isolamentosPaciente);

    // 3. Aplicação das Regras de Negócio em Cascata
    for (const leito of candidatos) {
      // REGRA 1: Compatibilidade com Leito PCP
      if (leito.isPCP) {
        const idade = calcularIdade(paciente.dataNascimento);
        const temIsolamento = isolamentosPaciente.length > 0;
        if (idade < 18 || idade > 60 || temIsolamento) {
          continue; // Descarta o leito e vai para o próximo
        }
      }

      // REGRA 2: Lógica de Quarto e Coorte
      if (!leito.quartoId) {
        // Leito avulso (sem quarto) é compatível por padrão (se passou no PCP)
        compativeis.push(leito);
        continue;
      }

      const leitosDoMesmoQuarto = (leitosPorQuartoId.get(leito.quartoId) || [])
        .filter((leitoDoQuarto) => leitoDoQuarto.id !== leito.id);
      const ocupantesDoQuarto = leitosDoMesmoQuarto
        .map((leitoDoQuarto) => pacientesPorLeitoId.get(leitoDoQuarto.id))
        .filter(Boolean);

      // REGRA 3: Compatibilidade de Sexo
      if (ocupantesDoQuarto.length > 0) {
        const sexoDoQuarto = normalizarSexo(
          ocupantesDoQuarto[0]?.sexo ?? ocupantesDoQuarto[0]?.sexoPaciente
        );
        if (sexoDoQuarto !== sexoPacienteNormalizado) {
          continue; // Sexos incompatíveis, descarta o leito
        }
      }

      // REGRA 4: Compatibilidade de Isolamento
      if (ocupantesDoQuarto.length > 0) {
        const isolamentosOcupante =
          ocupantesDoQuarto[0]?.isolamentos ??
          ocupantesDoQuarto[0]?.isolamentosVigentes ??
          [];
        const chaveIsolamentoOcupantes = normalizarIsolamentos(isolamentosOcupante);
        if (chaveIsolamentoPaciente !== chaveIsolamentoOcupantes) {
          continue; // Isolamentos incompatíveis, descarta o leito
        }
      }
      // Se um paciente sem isolamento tenta entrar em quarto com isolamento (ou vice-versa),
      // as chaves serão diferentes ('' vs 'id_kpc'), barrando a entrada.

      // Se o leito passou por todas as regras, ele é compatível!
      compativeis.push(leito);
    }

    return compativeis;
  };

  const leitosCompativeis = useMemo(() => {
    if (dados.loading || !paciente) return [];
    return getLeitosCompatíveis(paciente, dados, modo);
  }, [dados, paciente, modo]);

  // Filtrar leitos por termo de busca e agrupar por setor
  const leitosPorSetor = useMemo(() => {
    // Primeiro aplicar filtro de busca
    const leitosFiltrados = leitosCompativeis.filter(leito => {
      if (!termoBusca.trim()) return true;
      return leito.codigoLeito.toLowerCase().includes(termoBusca.toLowerCase().trim());
    });

    const grupos = {};
    
    leitosFiltrados.forEach(leito => {
      const setor = dados.setores.find(s => s.id === leito.setorId);
      const nomeSetor = setor?.nomeSetor || 'Setor Desconhecido';
      
      if (!grupos[nomeSetor]) {
        grupos[nomeSetor] = [];
      }
      
      grupos[nomeSetor].push({
        ...leito,
        nomeSetor: nomeSetor,
        siglaSetor: setor?.siglaSetor || nomeSetor
      });
    });

    // Ordenar leitos dentro de cada setor por codigoLeito
    Object.keys(grupos).forEach(setor => {
      grupos[setor].sort((a, b) => a.codigoLeito.localeCompare(b.codigoLeito));
    });

    return grupos;
  }, [leitosCompativeis, dados.setores, termoBusca]);

  const handleLeitoClick = (leito) => {
    const setor = dados.setores.find(s => s.id === leito.setorId);
    onLeitoSelect({
      ...leito,
      nomeSetor: setor?.nomeSetor,
      siglaSetor: setor?.siglaSetor
    });
  };

  if (dados.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando leitos disponíveis...</span>
      </div>
    );
  }

  // Verificar se há leitos após filtragem
  const temLeitosDisponiveis = Object.keys(leitosPorSetor).length > 0;

  if (leitosCompativeis.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
        <p className="text-muted-foreground">
          Nenhum leito compatível encontrado com base nas regras de {modo === 'uti' ? 'UTI' : 'sexo, idade e isolamento'}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Campo de Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar leito por código..."
          value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista de Leitos */}
      {!temLeitosDisponiveis ? (
        <div className="text-center py-8 space-y-3">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
          <p className="text-muted-foreground">
            Nenhum leito compatível encontrado, verifique o leito digitado ou se não há alguma condição que torna o leito pesquisado incompatível (idade, sexo, isolamento, status).
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <Accordion type="single" collapsible className="space-y-2">
        {Object.entries(leitosPorSetor).map(([nomeSetor, leitosDoSetor]) => (
          <AccordionItem key={nomeSetor} value={nomeSetor} className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-sm text-primary">
                  {nomeSetor}
                </span>
                <Badge variant="secondary" className="ml-2">
                  {leitosDoSetor.length} leito{leitosDoSetor.length > 1 ? 's' : ''}
                </Badge>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {leitosDoSetor.map(leito => (
                  <div
                    key={leito.id}
                    onClick={() => handleLeitoClick(leito)}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Bed className="h-4 w-4 text-primary group-hover:text-primary/80" />
                      <span className="font-medium text-sm">{leito.codigoLeito}</span>
                    </div>
                    
                    <Badge 
                      variant="outline"
                      className={
                        (leito.statusLeito || leito.status) === 'Vago' 
                          ? 'bg-green-500 text-white border-green-500' 
                          : 'bg-yellow-500 text-white border-yellow-500'
                      }
                    >
                      {leito.statusLeito || leito.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
          ))}
          </Accordion>
        </ScrollArea>
      )}
    </div>
  );
};

export default LeitoSelectionStep;