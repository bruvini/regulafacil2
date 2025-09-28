// src/components/modals/RegularPacienteModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CheckCircle, XCircle, Bed } from "lucide-react";
import { getHospitalData } from '@/lib/hospitalData';
import { getLeitosCompativeis } from '@/lib/compatibilidadeLeitos'; // Importando nosso novo motor de regras!
import ConfirmarRegulacaoModal from './ConfirmarRegulacaoModal';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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

  const [loadingData, setLoadingData] = useState(true);
  const [hospitalData, setHospitalData] = useState(null);
  const [error, setError] = useState(null);

  // Carrega os dados da Fase 1
  useEffect(() => {
    if (isOpen && modalStep === 'selecao' && !leitoSugerido) {
      setLoadingData(true);
      setError(null);
      getHospitalData()
        .then(setHospitalData)
        .catch(err => {
          console.error("Erro ao carregar dados do hospital:", err);
          setError("Falha ao carregar os dados do hospital.");
        })
        .finally(() => setLoadingData(false));
    }
  }, [isOpen, modalStep, leitoSugerido]);

  // Executa as regras da Fase 2 e memoriza o resultado
  const relatorioCompatibilidade = useMemo(() => {
    if (!hospitalData || !paciente) {
      return { compativeis: [], rejeitados: [] };
    }
    // Adiciona a idade ao objeto do paciente para uso nas regras
    const pacienteComIdade = { ...paciente, idade: calcularIdade(paciente.dataNascimento) };
    return getLeitosCompativeis(pacienteComIdade, hospitalData);
  }, [hospitalData, paciente]);
  
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

  const RelatorioResultados = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh]">
      {/* Coluna de Leitos Compatíveis */}
      <div className="flex flex-col space-y-3">
        <div className="flex items-center text-green-600">
          <CheckCircle className="h-5 w-5 mr-2" />
          <h3 className="font-semibold">{relatorioCompatibilidade.compativeis.length} Leitos Compatíveis</h3>
        </div>
        <ScrollArea className="border rounded-lg p-2 flex-1">
          {relatorioCompatibilidade.compativeis.length > 0 ? (
            <div className="space-y-2">
              {relatorioCompatibilidade.compativeis.map(leito => (
                <div key={leito.id} className="flex items-center gap-2 p-2 bg-green-50 rounded-md">
                  <Bed className="h-4 w-4 text-green-700" />
                  <span className="font-mono text-sm">{leito.codigoLeito}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-sm text-muted-foreground p-4">Nenhum leito compatível encontrado.</p>}
        </ScrollArea>
      </div>

      {/* Coluna de Leitos Rejeitados */}
      <div className="flex flex-col space-y-3">
        <div className="flex items-center text-red-600">
          <XCircle className="h-5 w-5 mr-2" />
          <h3 className="font-semibold">{relatorioCompatibilidade.rejeitados.length} Leitos Rejeitados</h3>
        </div>
        <ScrollArea className="border rounded-lg p-2 flex-1">
           {relatorioCompatibilidade.rejeitados.length > 0 ? (
            <div className="space-y-2">
              {relatorioCompatibilidade.rejeitados.map(({leito, motivo}) => (
                <div key={leito.id} className="flex items-center justify-between gap-2 p-2 bg-red-50 rounded-md">
                   <div className="flex items-center gap-2">
                     <Bed className="h-4 w-4 text-red-700" />
                     <span className="font-mono text-sm">{leito.codigoLeito}</span>
                   </div>
                   <Badge variant="destructive" className="text-xs">{motivo}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-sm text-muted-foreground p-4">Nenhum leito rejeitado.</p>}
        </ScrollArea>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={isOpen && modalStep === 'selecao'} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Fase 2: Diagnóstico do Motor de Regras ({paciente?.nomePaciente})
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {loadingData && (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin mr-3" />
                <span>Analisando compatibilidade...</span>
              </div>
            )}
            {error && <p className="text-red-500">{error}</p>}
            {!loadingData && hospitalData && <RelatorioResultados />}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação */}
      {leitoSelecionado && paciente && modalStep === 'confirmacao' && (
         <Dialog open={true} onOpenChange={() => {}}>
           <DialogContent className="max-w-lg">
             {/* ... conteúdo do modal de confirmação ... */}
           </DialogContent>
         </Dialog>
      )}
    </>
  );
};

export default RegularPacienteModal;
