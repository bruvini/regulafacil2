import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";
import { useDadosHospitalares } from "@/hooks/useDadosHospitalares";

const formatarMensagemRestricaoCoorte = (restricao) => {
  if (!restricao) {
    return '';
  }

  const { sexo, isolamentos } = restricao;
  if (isolamentos && isolamentos.length > 0) {
    return `Permitido apenas pacientes do sexo ${sexo} com isolamento de ${isolamentos.join(', ')}`;
  }

  return `Permitido apenas pacientes do sexo ${sexo}`;
};

const PassagemPlantaoModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const {
    estrutura,
    infeccoes: infeccoesDados = [],
  } = useDadosHospitalares();

  const ORDEM_TIPO_SETOR = ["Enfermaria", "UTI", "Centro Cirúrgico", "Emergência"];

  const ORDEM_SETORES = {
    Enfermaria: [
      "UNID. JS ORTOPEDIA",
      "UNID. INT. GERAL - UIG",
      "UNID. DE AVC - INTEGRAL",
      "UNID. NEFROLOGIA TRANSPLANTE",
      "UNID. CIRURGICA",
      "UNID. ONCOLOGIA",
      "UNID. CLINICA MEDICA",
    ],
    UTI: ["UTI"],
    "Centro Cirúrgico": ["CC - RECUPERAÇÃO", "CC - SALAS CIRURGICAS"],
    Emergência: [
      "UNID. AVC AGUDO",
      "SALA DE EMERGENCIA",
      "SALA LARANJA",
      "PS DECISÃO CIRURGICA",
      "PS DECISão CLINICA",
    ],
  };

  useEffect(() => {
    let timeoutId;

    if (isOpen) {
      setLoading(true);
      timeoutId = setTimeout(() => {
        setLoading(false);
      }, 2000);
    } else {
      setLoading(true);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isOpen]);

  const handleOpenChange = (open) => {
    if (!open) {
      onClose?.();
    }
  };

  const estruturaOrdenada = useMemo(() => {
    if (!estrutura) return [];

    const infeccoesMap = new Map(infeccoesDados.map(i => [i.id, i]));

    const ordenarSetores = (tipoSetor, setores) => {
      const ordemParaTipo = ORDEM_SETORES[tipoSetor] || [];
      const setoresFiltrados = tipoSetor === 'Centro Cirúrgico'
        ? setores.filter((setor) =>
            ['CC - RECUPERAÇÃO', 'CC - SALAS CIRURGICAS'].includes(setor?.nomeSetor),
          )
        : setores;

      return [...setoresFiltrados].sort((a, b) => {
        const indexA = ordemParaTipo.indexOf(a.nomeSetor);
        const indexB = ordemParaTipo.indexOf(b.nomeSetor);

        if (ordemParaTipo.length === 0) {
          return a.nomeSetor.localeCompare(b.nomeSetor);
        }

        if (indexA === -1 && indexB === -1) {
          return a.nomeSetor.localeCompare(b.nomeSetor);
        }

        if (indexA === -1) return 1;
        if (indexB === -1) return -1;

        return indexA - indexB;
      });
    };

    const tiposEstrutura = Object.keys(estrutura);

    const processarSetores = (tipoSetor, setoresLista) => {
      const setoresOrdenados = ordenarSetores(tipoSetor, setoresLista);

      const setoresProcessados = setoresOrdenados.map(setor => {
        if (tipoSetor !== 'Enfermaria') {
          return { ...setor, dadosPlantao: null };
        }

        // INÍCIO DA LÓGICA CORRIGIDA
        const dadosPlantao = {
          isolamentos: [], leitosRegulados: [], leitosVagos: [],
          pedidosUTI: [], transferencias: [], observacoes: []
        };

        // A estrutura já contém os leitos dentro dos quartos ou como leitosSemQuarto
        const todosOsLeitosDoSetor = [
          ...(setor.quartos || []).flatMap(q => q.leitos),
          ...(setor.leitosSemQuarto || [])
        ];

        todosOsLeitosDoSetor.forEach(leito => {
          // --- ESTA É A CORREÇÃO PRINCIPAL ---
          const paciente = leito.paciente; // Acessa o paciente aninhado diretamente!

          // 1. Leitos Vagos (agora com a coorte correta)
          if (leito.status === 'Vago' || leito.status === 'Higienização') {
              const compatibilidade = leito.status === 'Vago' 
                ? (formatarMensagemRestricaoCoorte(leito.restricaoCoorte) || 'Livre') 
                : 'N/A';
              dadosPlantao.leitosVagos.push({
                  id: leito.id, codigoLeito: leito.codigoLeito,
                  status: leito.status, compatibilidade: compatibilidade
              });
          }

          // 2. Leitos Regulados (Reservados)
          if (leito.status === 'Reservado' && leito.regulacaoEmAndamento) {
              const infoReg = leito.regulacaoEmAndamento;
              const tempo = infoReg.iniciadoEm?.toDate ? format(infoReg.iniciadoEm.toDate(), 'dd/MM HH:mm') : '';
              dadosPlantao.leitosRegulados.push(
                  `${leito.codigoLeito} ${infoReg.pacienteNome} / VEM DE ${infoReg.leitoParceiroSetorNome} ${infoReg.leitoParceiroCodigo} (${tempo})`
              );
          }

          // 3. Processa dados APENAS se houver um paciente no leito
          if (paciente) {
              // Isolamentos
              if (paciente.isolamentos?.length > 0) {
                  const nomesIsolamentos = paciente.isolamentos.map(iso => {
                      const infeccao = infeccoesMap.get(iso.infeccaoId);
                      return infeccao?.siglaInfeccao || infeccao?.sigla || 'Desconhecido';
                  }).join(', ');
                  dadosPlantao.isolamentos.push(`${leito.codigoLeito} ${paciente.nomePaciente}: ${nomesIsolamentos}`);
              }

              // Pedidos de UTI
              if (paciente.pedidoUTI) {
                  dadosPlantao.pedidosUTI.push(`${leito.codigoLeito} ${paciente.nomePaciente}`);
              }

              // Transferências Externas
              if (paciente.pedidoTransferenciaExterna) {
                  const ped = paciente.pedidoTransferenciaExterna;
                  const ultimoStatus = ped.historicoStatus?.slice(-1)[0];
                  const ultimaAtualizacao = ultimoStatus ? ` | Última Info: ${ultimoStatus.texto}` : '';
                  dadosPlantao.transferencias.push(
                      `${leito.codigoLeito} ${paciente.nomePaciente} | Motivo: ${ped.motivo} | Destino: ${ped.destino}${ultimaAtualizacao}`
                  );
              }

              // Observações
              if (paciente.observacoes?.length > 0) {
                  const obsMaisRecente = [...paciente.observacoes].sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())[0];
                  dadosPlantao.observacoes.push(`${leito.codigoLeito} ${paciente.nomePaciente}: ${obsMaisRecente.texto}`);
              }
          }
        });

        return { ...setor, dadosPlantao };
      });

      return { tipoSetor, setores: setoresProcessados };
    };

    const gruposOrdenados = ORDEM_TIPO_SETOR.filter(
      (tipoSetor) => Array.isArray(estrutura[tipoSetor]) && estrutura[tipoSetor].length > 0,
    ).map((tipoSetor) => processarSetores(tipoSetor, estrutura[tipoSetor]));

    const tiposExtras = tiposEstrutura
      .filter((tipoSetor) => !ORDEM_TIPO_SETOR.includes(tipoSetor))
      .filter((tipoSetor) => Array.isArray(estrutura[tipoSetor]) && estrutura[tipoSetor].length > 0)
      .sort((a, b) => a.localeCompare(b));

    const gruposExtras = tiposExtras.map((tipoSetor) => processarSetores(tipoSetor, estrutura[tipoSetor]));

    return [...gruposOrdenados, ...gruposExtras];
  }, [estrutura, infeccoesDados]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Relatório de Passagem de Plantão</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Gerando relatório de passagem de plantão...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {estruturaOrdenada.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum setor disponível no momento.
                </p>
              ) : (
                <Accordion type="multiple" className="w-full space-y-4">
                  {estruturaOrdenada.map(({ tipoSetor, setores }) => (
                    <AccordionItem key={tipoSetor} value={tipoSetor}>
                      <AccordionTrigger className="text-xl font-semibold">
                        {tipoSetor}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col space-y-2 pt-2">
                          {setores.map((setor) => {
                            const setorKey = setor?.id ?? setor?.idSetor ?? setor?.nomeSetor;
                            return (
                              <div key={setorKey} className="p-4 border rounded-md">
                                <h4 className="font-medium text-md mb-3">{setor.nomeSetor}</h4>

                                {setor.dadosPlantao ? (
                                  <div className="space-y-4 text-sm">
                                    {setor.dadosPlantao.isolamentos.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Isolamentos:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.isolamentos.map((item, index) => <li key={index}>{item}</li>)}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.leitosRegulados.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Leitos Regulados (Reservados):</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.leitosRegulados.map((item, index) => <li key={index}>{item}</li>)}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.pedidosUTI.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-destructive mb-1">Pedidos de UTI:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-destructive">
                                          {setor.dadosPlantao.pedidosUTI.map((item, index) => <li key={index}>{item}</li>)}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.transferencias.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Transferências Externas:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.transferencias.map((item, index) => <li key={index}>{item}</li>)}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.observacoes.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-gray-700 mb-1">Observações Relevantes:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-600">
                                          {setor.dadosPlantao.observacoes.map((item, index) => <li key={index}>{item}</li>)}
                                        </ul>
                                      </div>
                                    )}

                                    {setor.dadosPlantao.leitosVagos.length > 0 && (
                                      <div>
                                        <h5 className="font-semibold text-green-700 mb-1">Leitos Vagos:</h5>
                                        <ul className="list-disc list-inside space-y-1 pl-2 text-green-600">
                                          {setor.dadosPlantao.leitosVagos.map(leito => (
                                            <li key={leito.id}>
                                              {leito.codigoLeito} ({leito.status})
                                              {leito.compatibilidade !== 'Livre' && ` - ${leito.compatibilidade}`}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Dados não aplicáveis para este tipo de setor.</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button disabled>Gerar PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PassagemPlantaoModal;
