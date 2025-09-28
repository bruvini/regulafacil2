// src/components/modals/RegularPacienteModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, BedDouble, User, Shield, AlertTriangle } from "lucide-react";
import { getHospitalData } from '@/lib/hospitalData';
import { getRelatorioCompatibilidade, getChavesIsolamentoAtivo } from '@/lib/compatibilidadeLeitos';
import ConfirmarRegulacaoModal from './ConfirmarRegulacaoModal';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Função para calcular idade (necessária para a regra de PCP)
const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return 0;
  let dataObj;
  if (typeof dataNascimento === 'string' && dataNascimento.includes('/')) {
    const [dia, mes, ano] = dataNascimento.split('/');
    dataObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
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

const RegularPacienteModal = ({
  isOpen,
  onClose,
  paciente,
  modo = 'enfermaria',
  leitoSugerido = null
}) => {
  const [modalStep, setModalStep] = useState('selecao');
  const [leitoSelecionado, setLeitoSelecionado] = useState(null);

  const [loading, setLoading] = useState(true);
  const [hospitalData, setHospitalData] = useState(null);
  const [error, setError] = useState(null);

  // Carrega os dados da Fase 1
  useEffect(() => {
    if (isOpen && modalStep === 'selecao' && !leitoSugerido) {
      setLoading(true);
      setError(null);
      getHospitalData()
        .then(setHospitalData)
        .catch(err => {
          console.error("Erro ao carregar dados do hospital:", err);
          setError("Falha ao carregar os dados do hospital.");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, modalStep, leitoSugerido]);

  const pacienteEnriquecido = useMemo(() => {
    if (!hospitalData || !paciente) return null;
    return hospitalData.pacientes.find(p => p.id === paciente.id) || null;
  }, [hospitalData, paciente]);

  const relatorio = useMemo(() => {
    if (!hospitalData || !paciente) return null;
    const pacienteAtualizado = hospitalData.pacientes.find(p => p.id === paciente.id);
    if (!pacienteAtualizado) return null;

    const pacienteComIdade = {
      ...pacienteAtualizado,
      idade: calcularIdade(pacienteAtualizado.dataNascimento),
    };
    return getRelatorioCompatibilidade(pacienteComIdade, hospitalData, modo);
  }, [hospitalData, paciente, modo]);

  // Preserva o fluxo de confirmação direta
  useEffect(() => {
    if (!isOpen) {
      setModalStep('selecao');
      setLeitoSelecionado(null);
      return;
    }
    if (leitoSugerido) {
      setLeitoSelecionado(leitoSugerido);
      setModalStep('confirmacao');
    }
  }, [isOpen, leitoSugerido]);

  const handleRegulacaoConcluida = () => {
    onClose();
    setModalStep('selecao');
    setLeitoSelecionado(null);
  };

  const ListaLeitos = ({ leitos }) => (
    <div className="space-y-1">
      {leitos.map(leito => (
        <div key={leito.id} className="flex items-center text-xs p-1 rounded bg-muted/50">
          <BedDouble className="h-3 w-3 mr-2 flex-shrink-0" />
          <span className="font-mono">{leito.codigoLeito}</span>
        </div>
      ))}
      {leitos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">Nenhum leito disponível.</p>
      )}
    </div>
  );

  const RuleCard = ({ title, icon: Icon, data }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{data.leitos.length}</div>
        <p className="text-xs text-muted-foreground">{data.mensagem}</p>
        <ScrollArea className="h-40 mt-4 border rounded-md p-2">
          <ListaLeitos leitos={data.leitos} />
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderRelatorio = () => {
    if (!relatorio) {
      return <p className="text-sm text-muted-foreground">Não foi possível gerar o relatório.</p>;
    }

    if (relatorio.modo === 'uti') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Modo UTI</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">{relatorio.regras.porTipoSetor.mensagem}</p>
            <ListaLeitos leitos={relatorio.compativeisFinais} />
          </CardContent>
        </Card>
      );
    }

    const { porSexo, porPCP, porIsolamento } = relatorio.regras;
    const pacienteParaResumo = pacienteEnriquecido || paciente;
    const isolamentosAtivos = pacienteEnriquecido
      ? [...getChavesIsolamentoAtivo(pacienteEnriquecido)].join(', ') || 'Nenhum'
      : 'Desconhecido';

    return (
      <div className="space-y-6">
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle className="text-base">Perfil do Paciente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><strong>Nome:</strong> {pacienteParaResumo?.nomePaciente || paciente?.nomePaciente}</p>
            <p><strong>Sexo:</strong> {pacienteEnriquecido?.sexo || paciente?.sexo || 'N/I'}</p>
            <p><strong>Isolamentos:</strong> {isolamentosAtivos}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <RuleCard title="Compatibilidade por Sexo" icon={User} data={porSexo} />
          <RuleCard title="Compatibilidade por PCP" icon={AlertTriangle} data={porPCP} />
          <RuleCard title="Compatibilidade por Isolamento" icon={Shield} data={porIsolamento} />
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen && modalStep === 'selecao'} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Fase 2.1: Diagnóstico por Regra de Negócio
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {loading && (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin mr-3" />
                <span>Carregando dados do hospital...</span>
              </div>
            )}
            {error && <p className="text-red-500 text-center">{error}</p>}
            {!loading && !error && hospitalData && renderRelatorio()}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {leitoSelecionado && paciente && modalStep === 'confirmacao' && (
        <ConfirmarRegulacaoModal
          isOpen
          onClose={onClose}
          paciente={paciente}
          leito={leitoSelecionado}
          onBack={() => {
            setModalStep('selecao');
            setLeitoSelecionado(null);
          }}
          onSuccess={handleRegulacaoConcluida}
        />
      )}
    </>
  );
};

export default RegularPacienteModal;
