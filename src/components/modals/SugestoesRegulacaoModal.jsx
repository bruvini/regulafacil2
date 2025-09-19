import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { intervalToDuration } from 'date-fns';
import {
  Building2,
  Bed,
  Users,
  ShieldAlert,
  Clock3,
  UserRound
} from 'lucide-react';

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
  if (!data) return 'Não informado';
  const agora = new Date();
  const duracao = intervalToDuration({ start: data, end: agora });
  if ((duracao.days ?? 0) > 0) {
    const horas = duracao.hours ?? 0;
    return `${duracao.days}d ${horas}h`;
  }
  if ((duracao.hours ?? 0) > 0) {
    const minutos = duracao.minutes ?? 0;
    return `${duracao.hours}h ${minutos}m`;
  }
  return `${duracao.minutes ?? 0}m`;
};

const extrairIsolamentos = (lista) => {
  if (!Array.isArray(lista)) return [];
  const mapa = new Map();
  lista.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      const chave = item.trim();
      if (chave) {
        mapa.set(chave.toLowerCase(), { sigla: chave, nome: chave });
      }
      return;
    }
    const sigla = item.siglaInfeccao || item.sigla || item.codigo || item.nome || '';
    const nome = item.nomeInfeccao || item.nome || sigla;
    const chave = (sigla || nome || '').toLowerCase();
    if (chave) {
      mapa.set(chave, {
        sigla: sigla || nome,
        nome: nome || sigla
      });
    }
  });
  return Array.from(mapa.values()).sort((a, b) =>
    (a.sigla || a.nome || '').localeCompare(b.sigla || b.nome || '', 'pt-BR')
  );
};

const formatarSexo = (valor) => {
  const texto = String(valor ?? '').trim().toUpperCase();
  if (texto.startsWith('M')) return 'Masculino';
  if (texto.startsWith('F')) return 'Feminino';
  return 'Não informado';
};

const SugestoesRegulacaoModal = ({
  isOpen,
  onClose,
  sugestoes = [],
  onSelecionarSugestao
}) => {
  const totais = useMemo(() => {
    const totalSetores = sugestoes.length;
    let totalLeitos = 0;
    let totalPacientes = 0;

    sugestoes.forEach((setor) => {
      const leitosDoSetor = setor?.sugestoes || [];
      totalLeitos += leitosDoSetor.length;
      leitosDoSetor.forEach((sugestao) => {
        totalPacientes += sugestao?.pacientesElegiveis?.length || 0;
      });
    });

    return { totalSetores, totalLeitos, totalPacientes };
  }, [sugestoes]);

  const handleSelecionar = (leito, paciente) => {
    if (onSelecionarSugestao) {
      onSelecionarSugestao(leito, paciente);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full max-h-[85vh] overflow-hidden">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-semibold">
            Sugestões de Regulação
          </DialogTitle>
          <DialogDescription>
            Sugestões priorizadas considerando isolamento, tempo de internação e idade dos pacientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Setores</p>
                <p className="text-lg font-semibold">{totais.totalSetores}</p>
              </div>
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Leitos sugeridos</p>
                <p className="text-lg font-semibold">{totais.totalLeitos}</p>
              </div>
              <Bed className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Pacientes elegíveis</p>
                <p className="text-lg font-semibold">{totais.totalPacientes}</p>
              </div>
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              1º Isolamento
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              2º Tempo de internação
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />
              3º Idade
            </Badge>
          </div>

          <Separator />

          <ScrollArea className="h-[55vh] pr-4">
            {sugestoes.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma sugestão disponível no momento.
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-3">
                {sugestoes.map((setor) => (
                  <AccordionItem
                    key={setor.setorId || setor.setorNome}
                    value={setor.setorId || setor.setorNome}
                    className="overflow-hidden rounded-xl border bg-background shadow-sm"
                  >
                    <AccordionTrigger className="px-4">
                      <div className="flex w-full items-center justify-between">
                        <div className="text-left">
                          <p className="text-sm font-semibold leading-tight">{setor.setorNome}</p>
                          {setor.setorSigla && (
                            <p className="text-xs uppercase text-muted-foreground">{setor.setorSigla}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {setor.sugestoes.length} leito(s)
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pt-0">
                      <Accordion type="multiple" className="space-y-2">
                        {setor.sugestoes.map((sugestao) => (
                          <AccordionItem
                            key={sugestao.leito.id}
                            value={sugestao.leito.id}
                            className="overflow-hidden rounded-lg border bg-muted/40"
                          >
                            <AccordionTrigger className="px-3 py-2">
                              <div className="flex w-full items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs font-semibold">
                                    {sugestao.leito.codigoLeito || 'Sem código'}
                                  </Badge>
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <span className="text-base leading-none">{sugestao.sexoContexto.simbolo}</span>
                                    {sugestao.sexoContexto.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {sugestao.leito.isPCP && (
                                    <Badge variant="secondary" className="text-xs">
                                      PCP
                                    </Badge>
                                  )}
                                  {sugestao.isolamentoContexto.chave !== '' && (
                                    <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                                      <ShieldAlert className="h-3 w-3" />
                                      Isolamento
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {sugestao.pacientesElegiveis.length} paciente(s)
                                  </Badge>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-3 bg-background px-3 pb-4 pt-0">
                              {sugestao.isolamentoContexto.chave !== '' && sugestao.isolamentoContexto.detalhes.length > 0 && (
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {sugestao.isolamentoContexto.detalhes.map((iso) => (
                                    <Badge
                                      key={`${sugestao.leito.id}-${iso.sigla || iso.nome}`}
                                      variant="outline"
                                      className="border-amber-400 text-amber-600"
                                    >
                                      {iso.sigla || iso.nome}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <div className="space-y-3">
                                {sugestao.pacientesElegiveis.map((paciente) => {
                                  const idade = calcularIdade(paciente.dataNascimento);
                                  const tempoInternacao = formatarTempoInternacao(paciente.dataInternacao);
                                  const isolamentosPaciente = extrairIsolamentos(paciente.isolamentos);
                                  const sexoPaciente = formatarSexo(paciente.sexo);
                                  return (
                                    <div
                                      key={paciente.id}
                                      className="rounded-lg border bg-background p-3 shadow-sm transition-colors hover:border-primary/40"
                                    >
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-semibold leading-snug">
                                              {paciente.nomePaciente}
                                            </h4>
                                            <Badge variant="outline" className="text-xs font-medium">
                                              {idade} anos
                                            </Badge>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                            {isolamentosPaciente.length > 0 && (
                                              <span className="flex items-center gap-1 text-amber-600">
                                                <ShieldAlert className="h-3.5 w-3.5" />
                                                Isolamento ativo
                                              </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                              <Clock3 className="h-3.5 w-3.5" />
                                              {tempoInternacao}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {isolamentosPaciente.length > 0 && (
                                            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                                              <ShieldAlert className="h-3 w-3 text-amber-500" />
                                              Prioridade
                                            </Badge>
                                          )}
                                          <Button size="sm" onClick={() => handleSelecionar(sugestao.leito, paciente)}>
                                            Regular
                                          </Button>
                                        </div>
                                      </div>
                                      {isolamentosPaciente.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {isolamentosPaciente.map((iso) => (
                                            <Badge
                                              key={`${paciente.id}-${iso.sigla || iso.nome}`}
                                              variant="outline"
                                              className="border-amber-400 text-amber-600"
                                            >
                                              {iso.sigla || iso.nome}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                        <div>
                                          <span className="font-semibold text-foreground">Origem: </span>
                                          {paciente.origem || paciente.unidadeInternacao || 'Não informado'}
                                        </div>
                                        <div>
                                          <span className="font-semibold text-foreground">Especialidade: </span>
                                          {paciente.especialidade || 'Não informado'}
                                        </div>
                                        <div>
                                          <span className="font-semibold text-foreground">Sexo: </span>
                                          {sexoPaciente}
                                        </div>
                                        <div>
                                          <span className="font-semibold text-foreground">Tempo de internação: </span>
                                          {tempoInternacao}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SugestoesRegulacaoModal;
