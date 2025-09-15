import React, { useMemo } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Bed, AlertCircle, Search } from "lucide-react";

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

    const normalizarIsolamentos = (lista) => {
      if (!Array.isArray(lista) || lista.length === 0) return '';

      return lista
        .map((item) => {
          if (!item) return '';
          if (typeof item === 'string' || typeof item === 'number') {
            return String(item).trim().toLowerCase();
          }

          const identificador =
            item.infecaoId ||
            item.infeccaoId ||
            item.id ||
            item.codigo ||
            item.nome ||
            '';

          return String(identificador).trim().toLowerCase();
        })
        .filter(Boolean)
        .sort()
        .join('|');
    };

    const possuiInformacaoAtiva = (campo) => {
      if (!campo) return false;
      if (typeof campo === 'object') {
        return Object.keys(campo).length > 0;
      }
      return Boolean(campo);
    };

    const obterTipoSetorNormalizado = (setor) =>
      String(setor?.tipoSetor || '').trim().toLowerCase();

    const normalizarStatus = (status) =>
      String(status || '').trim().toLowerCase();

    const obterStatusLeito = (leito) => {
      const statusValor = leito?.status ?? leito?.statusLeito ?? '';
      return normalizarStatus(statusValor);
    };

    const possuiReservaOuRegulacao = (leito) =>
      possuiInformacaoAtiva(leito?.regulacaoEmAndamento) ||
      possuiInformacaoAtiva(leito?.reservaExterna) ||
      possuiInformacaoAtiva(leito?.regulacaoReserva);

    const statusElegiveis = new Set(['vago', 'higienização', 'higienizacao']);
    const statusOcupado = 'ocupado';

    const setoresPorId = new Map(setores.map((setor) => [setor.id, setor]));

    if (modo === 'uti') {
      return leitos.filter((leito) => {
        const setor = setoresPorId.get(leito.setorId);

        if (obterTipoSetorNormalizado(setor) !== 'uti') return false;
        if (!statusElegiveis.has(obterStatusLeito(leito))) return false;
        if (possuiReservaOuRegulacao(leito)) return false;

        return true;
      });
    }

    const idadePaciente = calcularIdade(paciente.dataNascimento);
    const chaveIsolamentoPaciente = normalizarIsolamentos(paciente.isolamentos);
    const normalizarSexo = (valor) =>
      (typeof valor === 'string' ? valor.trim().toUpperCase() : '');
    const sexoPaciente = normalizarSexo(paciente?.sexo);

    const pacientesPorLeito = new Map();
    pacientesExistentes.forEach((pacienteAtual) => {
      if (pacienteAtual?.leitoId) {
        pacientesPorLeito.set(pacienteAtual.leitoId, pacienteAtual);
      }
    });

    const leitosPorQuarto = new Map();
    leitos.forEach((leitoAtual) => {
      if (!leitoAtual?.quartoId) return;
      if (!leitosPorQuarto.has(leitoAtual.quartoId)) {
        leitosPorQuarto.set(leitoAtual.quartoId, []);
      }
      leitosPorQuarto.get(leitoAtual.quartoId).push(leitoAtual);
    });

    const candidatos = leitos.filter((leito) => {
      const setor = setoresPorId.get(leito.setorId);

      if (obterTipoSetorNormalizado(setor) !== 'enfermaria') return false;
      if (!statusElegiveis.has(obterStatusLeito(leito))) return false;
      if (possuiReservaOuRegulacao(leito)) return false;

      return true;
    });

    const leitosCompativeis = [];

    candidatos.forEach((leito) => {
      if (leito.isPCP) {
        if (idadePaciente < 18 || idadePaciente > 60) {
          return;
        }
        if (chaveIsolamentoPaciente !== '') {
          return;
        }
      }

      const quartoId = leito.quartoId;
      if (!quartoId) {
        leitosCompativeis.push(leito);
        return;
      }

      const leitosMesmoQuarto = (leitosPorQuarto.get(quartoId) || [])
        .filter((outroLeito) => outroLeito.id !== leito.id);

      const ocupantesDoQuarto = leitosMesmoQuarto
        .filter((outroLeito) => obterStatusLeito(outroLeito) === statusOcupado)
        .map((leitoOcupado) => pacientesPorLeito.get(leitoOcupado.id))
        .filter(Boolean);

      if (ocupantesDoQuarto.length > 0) {
        const sexoReferencia = normalizarSexo(ocupantesDoQuarto[0]?.sexo);
        if (sexoPaciente && sexoReferencia && sexoPaciente !== sexoReferencia) {
          return;
        }

        if (sexoPaciente) {
          const algumSexoDiferente = ocupantesDoQuarto.some((ocupante) => {
            const sexoOcupante = normalizarSexo(ocupante?.sexo);
            return sexoOcupante && sexoOcupante !== sexoPaciente;
          });

          if (algumSexoDiferente) {
            return;
          }
        }

        const chaveIsolamentoOcupantes = normalizarIsolamentos(
          ocupantesDoQuarto[0]?.isolamentos
        );

        const isolamentosDivergentesEntreOcupantes = ocupantesDoQuarto.some(
          (ocupante) =>
            normalizarIsolamentos(ocupante?.isolamentos) !==
            chaveIsolamentoOcupantes
        );

        if (isolamentosDivergentesEntreOcupantes) {
          return;
        }

        if (chaveIsolamentoPaciente !== chaveIsolamentoOcupantes) {
          return;
        }
      }

      leitosCompativeis.push(leito);
    });

    return leitosCompativeis;
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