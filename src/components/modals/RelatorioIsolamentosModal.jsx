import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getPacientesCollection,
  getLeitosCollection,
  getQuartosCollection,
  getSetoresCollection,
  getInfeccoesCollection,
  getDocs
} from '@/lib/firebase';

const RelatorioIsolamentosModal = ({ isOpen, onClose }) => {
  const [dados, setDados] = useState({
    pacientes: {},
    leitos: {},
    quartos: {},
    setores: {},
    infeccoes: {},
    loading: true
  });

  // Carregar todos os dados necessários
  useEffect(() => {
    if (!isOpen) return;

    const carregarDados = async () => {
      try {
        setDados(prev => ({ ...prev, loading: true }));

        const [
          pacientesSnapshot,
          leitosSnapshot,
          quartosSnapshot,
          setoresSnapshot,
          infeccoesSnapshot
        ] = await Promise.all([
          getDocs(getPacientesCollection()),
          getDocs(getLeitosCollection()),
          getDocs(getQuartosCollection()),
          getDocs(getSetoresCollection()),
          getDocs(getInfeccoesCollection())
        ]);

        // Converter snapshots para objetos indexados por ID
        const pacientes = {};
        pacientesSnapshot.forEach(doc => {
          pacientes[doc.data().nomePaciente] = { id: doc.id, ...doc.data() };
        });

        const leitos = {};
        leitosSnapshot.forEach(doc => {
          leitos[doc.id] = { id: doc.id, ...doc.data() };
        });

        const quartos = {};
        quartosSnapshot.forEach(doc => {
          quartos[doc.id] = { id: doc.id, ...doc.data() };
        });

        const setores = {};
        setoresSnapshot.forEach(doc => {
          setores[doc.id] = { id: doc.id, ...doc.data() };
        });

        const infeccoes = {};
        infeccoesSnapshot.forEach(doc => {
          infeccoes[doc.id] = { id: doc.id, ...doc.data() };
        });

        setDados({
          pacientes,
          leitos,
          quartos,
          setores,
          infeccoes,
          loading: false
        });
      } catch (error) {
        console.error('Erro ao carregar dados para relatório:', error);
        setDados(prev => ({ ...prev, loading: false }));
      }
    };

    carregarDados();
  }, [isOpen]);

  // Processar e estruturar dados para o relatório
  const relatorioEstruturado = useMemo(() => {
    if (dados.loading || !dados.pacientes) return {};

    // 1. Filtrar pacientes com isolamentos
    const pacientesComIsolamento = Object.values(dados.pacientes).filter(
      paciente => paciente.isolamentos && paciente.isolamentos.length > 0
    );

    // 2. Enriquecer dados dos pacientes
    const pacientesEnriquecidos = pacientesComIsolamento.map(paciente => {
      const leito = dados.leitos[paciente.leitoId] || {};
      const setor = dados.setores[paciente.setorId] || {};
      const quarto = leito.quartoId ? dados.quartos[leito.quartoId] : null;

      // Enriquecer isolamentos com informações da infecção
      const isolamentosEnriquecidos = paciente.isolamentos.map(isolamento => {
        const infeccao = dados.infeccoes[isolamento.infeccaoId] || {};
        return {
          ...isolamento,
          siglaInfeccao: infeccao.siglaInfeccao || 'N/A',
          nomeInfeccao: infeccao.nomeInfeccao || 'Infecção não identificada'
        };
      });

      return {
        ...paciente,
        leito,
        setor,
        quarto,
        isolamentosEnriquecidos
      };
    });

    // 3. Agrupar por setor
    const agrupoPorSetor = {};
    pacientesEnriquecidos.forEach(paciente => {
      const nomeSetor = paciente.setor.nomeSetor || 'Setor não identificado';
      if (!agrupoPorSetor[nomeSetor]) {
        agrupoPorSetor[nomeSetor] = [];
      }
      agrupoPorSetor[nomeSetor].push(paciente);
    });

    // 4. Ordenar pacientes dentro de cada setor por código do leito
    Object.keys(agrupoPorSetor).forEach(nomeSetor => {
      agrupoPorSetor[nomeSetor].sort((a, b) => {
        const codigoA = a.leito.codigoLeito || '';
        const codigoB = b.leito.codigoLeito || '';
        return codigoA.localeCompare(codigoB);
      });
    });

    return agrupoPorSetor;
  }, [dados]);

  const totalPacientes = useMemo(() => {
    return Object.values(relatorioEstruturado).reduce((total, pacientes) => total + pacientes.length, 0);
  }, [relatorioEstruturado]);

  const renderizarQuarto = (pacientes, index) => {
    const pacienteAtual = pacientes[index];
    const pacienteAnterior = index > 0 ? pacientes[index - 1] : null;
    
    // Renderizar título do quarto apenas se é o primeiro paciente do quarto
    if (pacienteAtual.quarto && 
        (!pacienteAnterior || pacienteAnterior.quarto?.id !== pacienteAtual.quarto.id)) {
      return (
        <h3 className="text-md font-semibold ml-4 mb-2 text-primary">
          {pacienteAtual.quarto.nomeQuarto}
        </h3>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Relatório de Pacientes em Isolamento
          </DialogTitle>
        </DialogHeader>

        {dados.loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando dados...</span>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                <span className="font-medium">
                  Total de pacientes em isolamento: {totalPacientes}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>

            <ScrollArea className="max-h-[60vh] pr-4">
              {Object.keys(relatorioEstruturado).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum paciente em isolamento encontrado.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(relatorioEstruturado).map(([nomeSetor, pacientes]) => (
                    <div key={nomeSetor}>
                      <h2 className="text-lg font-bold mt-4 mb-3 p-3 bg-primary/10 rounded-md border-l-4 border-primary">
                        {nomeSetor} ({pacientes.length} paciente{pacientes.length > 1 ? 's' : ''})
                      </h2>
                      
                      {pacientes.map((paciente, index) => (
                        <div key={paciente.id} className="mb-4">
                          {renderizarQuarto(pacientes, index)}
                          
                          <div className="ml-8">
                            <p className="font-medium text-foreground mb-2">
                              <span className="bg-muted px-2 py-1 rounded text-sm font-mono">
                                {paciente.leito.codigoLeito || 'N/A'}
                              </span>
                              {' '}- {paciente.nomePaciente}
                            </p>
                            
                            <ul className="ml-4 space-y-1">
                              {paciente.isolamentosEnriquecidos.map((isolamento, isolIndex) => (
                                <li key={isolIndex} className="text-sm">
                                  <div className="flex items-start gap-2">
                                    <div className="w-2 h-2 bg-destructive rounded-full mt-1.5 flex-shrink-0"></div>
                                    <div>
                                      <span className="font-semibold text-destructive">
                                        {isolamento.siglaInfeccao}:
                                      </span>
                                      {' '}Desde {' '}
                                      <span className="font-medium">
                                        {isolamento.dataInclusao ? 
                                          format(isolamento.dataInclusao.toDate(), 'dd/MM/yyyy', { locale: ptBR }) 
                                          : 'Data não informada'
                                        }
                                      </span>
                                      {' '}
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isolamento.status === 'CONFIRMADO' 
                                          ? 'bg-destructive/20 text-destructive' 
                                          : 'bg-warning/20 text-warning'
                                      }`}>
                                        {isolamento.status || 'SUSPEITO'}
                                      </span>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RelatorioIsolamentosModal;