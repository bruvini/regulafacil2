import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Bed, AlertCircle } from "lucide-react";
import { 
  getLeitosCollection,
  getQuartosCollection,
  getSetoresCollection,
  getPacientesCollection,
  onSnapshot
} from '@/lib/firebase';

const RegularPacienteModal = ({ isOpen, onClose, paciente, onLeitoSelecionado }) => {
  const [dados, setDados] = useState({
    leitos: [],
    quartos: [],
    setores: [],
    pacientes: [],
    loading: true
  });

  // Buscar todos os dados necessários
  useEffect(() => {
    if (!isOpen || !paciente) return;

    let unsubscribes = [];

    const buscarDados = async () => {
      setDados(prev => ({ ...prev, loading: true }));

      try {
        // Listener para leitos
        const unsubLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
          const leitosData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDados(prev => ({ ...prev, leitos: leitosData }));
        });

        // Listener para quartos
        const unsubQuartos = onSnapshot(getQuartosCollection(), (snapshot) => {
          const quartosData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDados(prev => ({ ...prev, quartos: quartosData }));
        });

        // Listener para setores
        const unsubSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
          const setoresData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDados(prev => ({ ...prev, setores: setoresData }));
        });

        // Listener para pacientes
        const unsubPacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
          const pacientesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDados(prev => ({ ...prev, pacientes: pacientesData, loading: false }));
        });

        unsubscribes = [unsubLeitos, unsubQuartos, unsubSetores, unsubPacientes];
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
        setDados(prev => ({ ...prev, loading: false }));
      }
    };

    buscarDados();

    return () => {
      unsubscribes.forEach(unsub => unsub && unsub());
    };
  }, [isOpen, paciente]);

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

  // Motor de Regras - Filtragem de Leitos Compatíveis
  const leitosCompativeis = useMemo(() => {
    if (dados.loading || !paciente) return [];

    const { leitos, quartos, setores, pacientes } = dados;
    const idadePaciente = calcularIdade(paciente.dataNascimento);
    const isolamentosPaciente = paciente.isolamentos || [];

    return leitos.filter(leito => {
      // 1. Filtro de Status e Tipo
      const setor = setores.find(s => s.id === leito.setorId);
      if (!setor || setor.tipoSetor !== 'Enfermaria') return false;
      if (!['Vago', 'Higienização'].includes(leito.statusLeito)) return false;

      // 2. Filtro de Idade (PCP)
      if (leito.isPCP && (idadePaciente < 18 || idadePaciente > 60)) return false;

      // 3. Filtro de Sexo (para leitos em quartos)
      if (leito.quartoId) {
        const outrosPacientesNoQuarto = pacientes.filter(p => 
          p.leitoId !== leito.id && // Não incluir o próprio paciente se já estiver no quarto
          leitos.some(l => l.id === p.leitoId && l.quartoId === leito.quartoId)
        );

        if (outrosPacientesNoQuarto.length > 0) {
          const sexosDiferentes = outrosPacientesNoQuarto.some(p => p.sexo !== paciente.sexo);
          if (sexosDiferentes) return false;
        }
      }

      // 4. Filtro de Isolamento (regra mais complexa)
      if (leito.quartoId) {
        const outrosPacientesNoQuarto = pacientes.filter(p => 
          p.leitoId !== leito.id && // Não incluir o próprio paciente
          leitos.some(l => l.id === p.leitoId && l.quartoId === leito.quartoId)
        );

        if (isolamentosPaciente.length === 0) {
          // Paciente sem isolamento só pode ir onde nenhum outro tem isolamento
          const algumOutroComIsolamento = outrosPacientesNoQuarto.some(p => 
            p.isolamentos && p.isolamentos.length > 0
          );
          if (algumOutroComIsolamento) return false;
        } else {
          // Paciente com isolamento
          if (outrosPacientesNoQuarto.length > 0) {
            // Todos os outros devem ter exatamente o mesmo conjunto de isolamentos
            const isolamentosPacienteIds = isolamentosPaciente.map(i => i.infecaoId).sort();
            
            const todosComMesmosIsolamentos = outrosPacientesNoQuarto.every(outroP => {
              const isolamentosOutro = outroP.isolamentos || [];
              if (isolamentosOutro.length !== isolamentosPaciente.length) return false;
              
              const isolamentosOutroIds = isolamentosOutro.map(i => i.infecaoId).sort();
              return JSON.stringify(isolamentosPacienteIds) === JSON.stringify(isolamentosOutroIds);
            });

            if (!todosComMesmosIsolamentos) return false;
          }
        }
      }

      return true;
    });
  }, [dados, paciente]);

  // Agrupar leitos por setor
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

    return grupos;
  }, [leitosCompativeis, dados.setores]);

  const handleLeitoClick = (leito) => {
    const setor = dados.setores.find(s => s.id === leito.setorId);
    onLeitoSelecionado({
      ...leito,
      nomeSetor: setor?.nomeSetor,
      siglaSetor: setor?.siglaSetor
    });
    onClose();
  };

  if (!paciente) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Selecionar Leito de Destino para: {paciente.nomePaciente}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {dados.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando leitos disponíveis...</span>
            </div>
          ) : leitosCompativeis.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
              <p className="text-muted-foreground">
                Nenhum leito compatível encontrado com base nas regras de sexo, idade e isolamento.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-6">
                {Object.entries(leitosPorSetor).map(([nomeSetor, leitosDoSetor]) => (
                  <div key={nomeSetor} className="space-y-3">
                    <h3 className="font-semibold text-sm text-primary border-b pb-2">
                      {nomeSetor} ({leitosDoSetor.length} leito{leitosDoSetor.length > 1 ? 's' : ''})
                    </h3>
                    
                    <div className="grid gap-2">
                      {leitosDoSetor.map(leito => (
                        <div
                          key={leito.id}
                          onClick={() => handleLeitoClick(leito)}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Bed className="h-4 w-4 text-primary" />
                            <span className="font-medium">{leito.codigoLeito}</span>
                          </div>
                          
                          <Badge 
                            variant={leito.statusLeito === 'Vago' ? 'default' : 'secondary'}
                            className={leito.statusLeito === 'Vago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                          >
                            {leito.statusLeito}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RegularPacienteModal;