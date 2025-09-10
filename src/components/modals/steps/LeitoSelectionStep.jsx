import React, { useMemo } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bed, AlertCircle } from "lucide-react";

const LeitoSelectionStep = ({ 
  dados, 
  paciente, 
  modo = 'enfermaria', 
  onLeitoSelect 
}) => {
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

    const { leitos, quartos, setores, pacientes } = todosOsDados;

    // Modo UTI - lógica simplificada
    if (modo === 'uti') {
      return leitos.filter((leito) => {
        const setor = setores.find((s) => s.id === leito.setorId);
        const status = leito.statusLeito || leito.status;
        
        // Apenas leitos UTI com status correto
        return setor && 
               setor.tipoSetor === 'UTI' && 
               ['Vago', 'Higienização'].includes(status);
      });
    }

    // Modo enfermaria - lógica completa
    const idadePaciente = calcularIdade(paciente.dataNascimento);
    const normalizarIsolamentos = (lista) => (lista || []).map(i => i.infecaoId).sort().join('|');
    const isolamentosPacienteKey = normalizarIsolamentos(paciente.isolamentos);

    const isLeitoAvulso = (leito) => {
      if (leito.quartoId) return false;
      if (Array.isArray(quartos) && quartos.length > 0) {
        return !quartos.some(q => Array.isArray(q.leitosIds) && q.leitosIds.includes(leito.id));
      }
      return true;
    };

    // Passo A: Pré-filtragem básica para todos os setores de enfermaria
    const candidatos = leitos.filter((leito) => {
      const setor = setores.find((s) => s.id === leito.setorId);
      const status = leito.statusLeito || leito.status;
      if (!setor || setor.tipoSetor !== 'Enfermaria') return false;
      if (!['Vago', 'Higienização'].includes(status)) return false;
      return true;
    });

    // Passo B: Aplicar regras detalhadas para cada candidato
    const compativeis = [];
    
    candidatos.forEach((leito) => {
      const setor = setores.find((s) => s.id === leito.setorId);
      if (!setor) return;

      // REGRA 1: Leito PCP (Idade)
      if (leito.isPCP) {
        if (idadePaciente < 18 || idadePaciente > 60) return;
      }

      const avulso = isLeitoAvulso(leito);

      // REGRA 2: Lógica de quartos vs. leito avulso
      let ocupantesDoQuarto = [];
      if (!avulso && leito.quartoId) {
        const leitosMesmoQuarto = leitos.filter((l) => l.quartoId === leito.quartoId && l.id !== leito.id);
        ocupantesDoQuarto = pacientes.filter((p) => leitosMesmoQuarto.some((l) => l.id === p.leitoId));

        // 2.2.a: Compatibilidade por sexo quando há ocupantes
        if (ocupantesDoQuarto.length > 0) {
          const sexosDiferentes = ocupantesDoQuarto.some((p) => p.sexo && paciente.sexo && p.sexo !== paciente.sexo);
          if (sexosDiferentes) return;
        }
      }

      // REGRA 3: Compatibilidade de isolamento
      if (!avulso) {
        if (ocupantesDoQuarto.length === 0) {
          // quarto vazio: ok
        } else {
          // Todos ocupantes devem ter exatamente o mesmo conjunto de isolamentos do paciente
          const matchTodos = ocupantesDoQuarto.every((p) => normalizarIsolamentos(p.isolamentos) === isolamentosPacienteKey);
          if (!matchTodos) return;
        }
      }
      // Leito avulso: não há restrição de sexo; isolamento sempre compatível

      // Se chegou até aqui, o leito é compatível
      compativeis.push(leito);
    });

    return compativeis;
  };

  const leitosCompativeis = useMemo(() => {
    if (dados.loading || !paciente) return [];
    return getLeitosCompatíveis(paciente, dados, modo);
  }, [dados, paciente, modo]);

  // Agrupar leitos por setor e ordenar por codigoLeito
  const leitosPorSetor = useMemo(() => {
    const grupos = {};
    
    leitosCompativeis.forEach(leito => {
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
  }, [leitosCompativeis, dados.setores]);

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
    <ScrollArea className="max-h-96">
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
                        leito.statusLeito === 'Vago' 
                          ? 'bg-green-500 text-white border-green-500' 
                          : 'bg-yellow-500 text-white border-yellow-500'
                      }
                    >
                      {leito.statusLeito}
                    </Badge>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ScrollArea>
  );
};

export default LeitoSelectionStep;