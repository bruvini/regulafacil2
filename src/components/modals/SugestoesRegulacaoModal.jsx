import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Bed,
  Users,
  Building2,
  Clock,
  Shield,
  Calendar
} from "lucide-react";

// Helper functions
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

const formatarTempoInternacao = (dataInternacao) => {
  const data = parseData(dataInternacao);
  if (!data) return 'Tempo indeterminado';
  
  const agora = new Date();
  const diff = agora.getTime() - data.getTime();
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (dias > 0) {
    return `${dias}d ${horas}h`;
  }
  return `${horas}h`;
};

const extrairIsolamentos = (lista) => {
  if (!Array.isArray(lista) || lista.length === 0) return [];
  
  return lista.map((item) => {
    if (typeof item === 'string') {
      return { sigla: item, nome: item };
    }
    return {
      sigla: item.siglaInfeccao || item.sigla || item.codigo || item.nome || 'N/A',
      nome: item.nomeInfeccao || item.nome || item.sigla || 'Isolamento não identificado'
    };
  });
};

const formatarSexo = (valor) => {
  const sexo = String(valor ?? '').trim().toUpperCase();
  if (sexo.startsWith('M')) return 'M';
  if (sexo.startsWith('F')) return 'F';
  return 'N/I';
};

const getSexoIcon = (sexo) => {
  switch (sexo) {
    case 'M': return '♂';
    case 'F': return '♀';
    default: return '⚥';
  }
};

const getPrioridadeIcon = (temIsolamento, tempoHoras) => {
  if (temIsolamento) return '🔴'; // Isolamento = prioridade máxima
  if (tempoHoras > 72) return '🟠'; // Mais de 3 dias
  if (tempoHoras > 24) return '🟡'; // Mais de 1 dia
  return '🟢'; // Menos de 1 dia
};

const calcularTempoInternacaoHoras = (dataInternacao) => {
  const data = parseData(dataInternacao);
  if (!data) return 0;
  const diff = Date.now() - data.getTime();
  return diff / (1000 * 60 * 60);
};

const SugestoesRegulacaoModal = ({ isOpen, onClose, sugestoes = [] }) => {
  const totais = useMemo(() => {
    let totalSetores = sugestoes.length;
    let totalLeitos = 0;
    let totalPacientes = 0;

    sugestoes.forEach(setor => {
      totalLeitos += setor.sugestoes?.length || 0;
      setor.sugestoes?.forEach(sugestao => {
        totalPacientes += sugestao.pacientesElegiveis?.length || 0;
      });
    });

    return { totalSetores, totalLeitos, totalPacientes };
  }, [sugestoes]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bed className="h-6 w-6 text-primary" />
            Sugestões de Regulação de Leitos
          </DialogTitle>
          <DialogDescription>
            Sistema inteligente de compatibilidade paciente-leito baseado em isolamentos, sexo e disponibilidade
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="space-y-6">
            {/* Resumo de Totais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Setores</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totais.totalSetores}</div>
                  <p className="text-xs text-muted-foreground">
                    com leitos disponíveis
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Leitos</CardTitle>
                  <Bed className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totais.totalLeitos}</div>
                  <p className="text-xs text-muted-foreground">
                    disponíveis para regulação
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pacientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totais.totalPacientes}</div>
                  <p className="text-xs text-muted-foreground">
                    elegíveis para internação
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Legenda de Prioridades */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Critérios de Priorização</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-500" />
                    <span>1º: Isolamento</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>2º: Tempo de Internação</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-500" />
                    <span>3º: Idade</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Sugestões por Setor */}
            {sugestoes.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <Bed className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Nenhuma sugestão disponível</p>
                    <p className="text-sm">
                      Não há pacientes elegíveis ou leitos compatíveis no momento.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="w-full">
                {sugestoes.map((setor) => (
                  <AccordionItem key={setor.setorId} value={setor.setorId}>
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div>
                          <span className="font-semibold">{setor.setorNome}</span>
                          {setor.setorSigla && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({setor.setorSigla})
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {setor.sugestoes?.length || 0} leito(s)
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {setor.sugestoes?.map((sugestao) => {
                          const leito = sugestao.leito;
                          const pacientes = sugestao.pacientesElegiveis || [];

                          return (
                            <Card key={leito.id} className="ml-4">
                              <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Bed className="h-4 w-4" />
                                  Leito {leito.codigoLeito || leito.numeroLeito || 'S/N'}
                                  {leito.isPCP && (
                                    <Badge variant="outline" className="text-xs">
                                      PCP
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs">
                                    {pacientes.length} candidato(s)
                                  </Badge>
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <Accordion type="single" collapsible>
                                  <AccordionItem value={`leito-${leito.id}`}>
                                    <AccordionTrigger className="text-sm">
                                      Ver pacientes elegíveis
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="space-y-3">
                                        {pacientes.map((paciente, index) => {
                                          const idade = calcularIdade(paciente.dataNascimento);
                                          const sexo = formatarSexo(paciente.sexo);
                                          const tempoInternacao = formatarTempoInternacao(paciente.dataInternacao);
                                          const isolamentos = extrairIsolamentos(paciente.isolamentos);
                                          const temIsolamento = isolamentos.length > 0;
                                          const tempoHoras = calcularTempoInternacaoHoras(paciente.dataInternacao);
                                          const prioridadeIcon = getPrioridadeIcon(temIsolamento, tempoHoras);

                                          return (
                                            <Card key={paciente.id || index} className="p-3 bg-muted/50">
                                              <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-sm">{prioridadeIcon}</span>
                                                    <span className="font-medium">
                                                      {paciente.nomeCompleto || paciente.nome || 'Nome não informado'}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-xs">
                                                      {idade}a {getSexoIcon(sexo)}
                                                    </Badge>
                                                  </div>
                                                </div>
                                                
                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                  <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Internado há {tempoInternacao}
                                                  </span>
                                                  {paciente.setorOrigem && (
                                                    <span>• Origem: {paciente.setorOrigem}</span>
                                                  )}
                                                  {paciente.especialidade && (
                                                    <span>• {paciente.especialidade}</span>
                                                  )}
                                                </div>

                                                {isolamentos.length > 0 && (
                                                  <div className="flex flex-wrap gap-1">
                                                    {isolamentos.map((iso, isoIndex) => (
                                                      <Badge
                                                        key={isoIndex}
                                                        variant="destructive"
                                                        className="text-xs"
                                                      >
                                                        <Shield className="h-3 w-3 mr-1" />
                                                        {iso.sigla}
                                                      </Badge>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </Card>
                                          );
                                        })}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SugestoesRegulacaoModal;
