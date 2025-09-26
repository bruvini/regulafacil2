import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, UserSearch } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';
import {
  getPacientesCollection,
  updateDoc, 
  doc, 
  arrayUnion 
} from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const GerenciarIsolamentosModal = ({ isOpen, onClose, pacientes, infeccoes }) => {
  const [etapa, setEtapa] = useState(1); // 1: Selecionar Paciente, 2: Gerenciar Isolamentos
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [buscarPaciente, setBuscarPaciente] = useState('');
  const [showPacientes, setShowPacientes] = useState(false);
  const [buscaInfeccao, setBuscaInfeccao] = useState('');
  
  // Estados para novo isolamento
  const [infeccoesSelecionadas, setInfeccoesSelecionadas] = useState([]);
  const [dadosIsolamentos, setDadosIsolamentos] = useState({});
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  const resetForm = () => {
    setEtapa(1);
    setPacienteSelecionado(null);
    setBuscarPaciente('');
    setInfeccoesSelecionadas([]);
    setDadosIsolamentos({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const pacientesFiltrados = pacientes.filter(p =>
    p.nomePaciente?.toLowerCase().includes(buscarPaciente.toLowerCase())
  );

  const infeccoesOrdenadas = useMemo(() => (
    [...infeccoes].sort((a, b) =>
      (a?.nomeInfeccao || '').localeCompare(b?.nomeInfeccao || '', 'pt-BR', { sensitivity: 'base' })
    )
  ), [infeccoes]);

  const infeccoesFiltradas = useMemo(() => {
    const termo = buscaInfeccao.trim().toLowerCase();
    if (!termo) {
      return infeccoesOrdenadas;
    }

    return infeccoesOrdenadas.filter((infeccao) => {
      const nome = infeccao?.nomeInfeccao?.toLowerCase() || '';
      const sigla = infeccao?.siglaInfeccao?.toLowerCase() || '';
      return nome.includes(termo) || sigla.includes(termo);
    });
  }, [buscaInfeccao, infeccoesOrdenadas]);

  const formatarDataInclusao = (valor) => {
    if (!valor) {
      return 'Data não definida';
    }

    let dataNormalizada = valor;

    if (valor instanceof Date) {
      dataNormalizada = valor;
    } else if (typeof valor === 'string' || typeof valor === 'number') {
      dataNormalizada = new Date(valor);
    } else if (typeof valor === 'object' && typeof valor.toDate === 'function') {
      dataNormalizada = valor.toDate();
    } else {
      return 'Data não definida';
    }

    return isValid(dataNormalizada)
      ? format(dataNormalizada, 'dd/MM/yyyy', { locale: ptBR })
      : 'Data não definida';
  };

  const handleSelecionarPaciente = (paciente) => {
    setPacienteSelecionado(paciente);
    setEtapa(2);
    setShowPacientes(false);
    setBuscarPaciente('');
  };

  const handleInfeccaoChange = (infeccaoId, checked) => {
    if (checked) {
      setInfeccoesSelecionadas(prev => [...prev, infeccaoId]);
      setDadosIsolamentos(prev => ({
        ...prev,
        [infeccaoId]: {
          dataInclusao: new Date(),
          status: 'Suspeito'
        }
      }));
    } else {
      setInfeccoesSelecionadas(prev => prev.filter(id => id !== infeccaoId));
      setDadosIsolamentos(prev => {
        const novo = { ...prev };
        delete novo[infeccaoId];
        return novo;
      });
    }
  };

  const handleDadosChange = (infeccaoId, campo, valor) => {
    setDadosIsolamentos(prev => ({
      ...prev,
      [infeccaoId]: {
        ...prev[infeccaoId],
        [campo]: valor
      }
    }));
  };

  const handleSalvarIsolamentos = async () => {
    if (infeccoesSelecionadas.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma infecção.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const novosIsolamentos = infeccoesSelecionadas.map(infeccaoId => ({
        id: uuidv4(),
        infeccaoId,
        dataInclusao: dadosIsolamentos[infeccaoId].dataInclusao,
        status: dadosIsolamentos[infeccaoId].status
      }));

      const pacienteRef = doc(db, getPacientesCollection().path, pacienteSelecionado.id);
      
      for (const isolamento of novosIsolamentos) {
        await updateDoc(pacienteRef, {
          isolamentos: arrayUnion(isolamento)
        });
      }

      const nomeInfeccoes = infeccoesSelecionadas.map(id => {
        const infeccao = infeccoes.find(inf => inf.id === id);
        return infeccao?.nomeInfeccao || 'Infecção desconhecida';
      }).join(', ');

      await logAction(
        "Gestão de Isolamentos",
        `Isolamentos adicionados para ${pacienteSelecionado.nomePaciente}: ${nomeInfeccoes}`,
        currentUser
      );

      toast({
        title: "Sucesso",
        description: "Isolamentos adicionados com sucesso!"
      });

      resetForm();
      handleClose();
    } catch (error) {
      console.error('Erro ao salvar isolamentos:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar isolamentos. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden p-0">
        <div className="flex h-full flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>
              {etapa === 1 ? 'Selecionar Paciente' : `Gerenciar Isolamentos - ${pacienteSelecionado?.nomePaciente}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              {etapa === 1 && (
                <div className="space-y-4">
                  <Label>Pesquisar e Selecionar Paciente</Label>
                  <Popover open={showPacientes} onOpenChange={setShowPacientes}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={showPacientes}
                        className="w-full justify-between"
                      >
                        {pacienteSelecionado
                          ? pacienteSelecionado.nomePaciente
                          : "Selecionar paciente..."
                        }
                        <UserSearch className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Buscar paciente..."
                          value={buscarPaciente}
                          onValueChange={setBuscarPaciente}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {pacientesFiltrados.map((paciente) => (
                              <CommandItem
                                key={paciente.id}
                                value={paciente.nomePaciente}
                                onSelect={() => handleSelecionarPaciente(paciente)}
                              >
                                {paciente.nomePaciente}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {etapa === 2 && (
                <div className="space-y-6">
                  {/* Isolamentos atuais */}
                  {pacienteSelecionado?.isolamentos && pacienteSelecionado.isolamentos.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Isolamentos Atuais</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {pacienteSelecionado.isolamentos.map((isolamento) => {
                            const infeccao = infeccoes.find(inf => inf.id === isolamento.infeccaoId);
                            return (
                              <div key={isolamento.id} className="flex items-center justify-between rounded border p-3">
                                <div>
                                  <div className="font-medium">{infeccao?.nomeInfeccao || 'Infecção não encontrada'}</div>
                                  <div className="text-sm text-muted-foreground">
                                    Status: {isolamento.status} |
                                    Data: {formatarDataInclusao(isolamento.dataInclusao)}
                                  </div>
                                </div>
                                {infeccao?.siglaInfeccao && (
                                  <Badge variant="outline" className="uppercase">
                                    {infeccao.siglaInfeccao}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Adicionar novos isolamentos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Plus className="h-5 w-5" />
                        Adicionar Novos Isolamentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {infeccoes.length === 0 ? (
                        <div className="py-4 text-center text-muted-foreground">
                          Nenhuma infecção cadastrada. Cadastre infecções primeiro.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="filtro-infeccao">Buscar infecção</Label>
                            <Input
                              id="filtro-infeccao"
                              placeholder="Digite o nome ou a sigla da infecção"
                              value={buscaInfeccao}
                              onChange={(event) => setBuscaInfeccao(event.target.value)}
                            />
                          </div>
                          <Label>Selecionar Infecções:</Label>
                          {infeccoesFiltradas.length === 0 && (
                            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                              Nenhuma infecção corresponde à busca.
                            </div>
                          )}
                          {infeccoesFiltradas.map((infeccao) => {
                            const selecionada = infeccoesSelecionadas.includes(infeccao.id);
                            const dataInclusaoSelecionada = dadosIsolamentos[infeccao.id]?.dataInclusao;
                            const dataInclusaoLabel = dataInclusaoSelecionada
                              ? formatarDataInclusao(dataInclusaoSelecionada)
                              : 'Selecionar data';

                            return (
                              <div key={infeccao.id} className="space-y-3">
                                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      id={infeccao.id}
                                      checked={selecionada}
                                      onCheckedChange={(checked) => handleInfeccaoChange(infeccao.id, checked)}
                                    />
                                    <Label htmlFor={infeccao.id} className="font-medium">
                                      {infeccao.nomeInfeccao}
                                    </Label>
                                  </div>
                                  {infeccao.siglaInfeccao && (
                                    <Badge variant="secondary" className="shrink-0 uppercase">
                                      {infeccao.siglaInfeccao}
                                    </Badge>
                                  )}
                                </div>

                                {selecionada && (
                                  <div className="space-y-4 rounded-lg border p-4">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                      {/* Data de Inclusão */}
                                      <div className="space-y-2">
                                        <Label>Data de Inclusão</Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              variant="outline"
                                              className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !dadosIsolamentos[infeccao.id]?.dataInclusao && "text-muted-foreground"
                                              )}
                                            >
                                              <CalendarIcon className="mr-2 h-4 w-4" />
                                              {dataInclusaoLabel}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0">
                                            <Calendar
                                              mode="single"
                                              selected={dadosIsolamentos[infeccao.id]?.dataInclusao}
                                              onSelect={(date) => handleDadosChange(infeccao.id, 'dataInclusao', date)}
                                              initialFocus
                                              className="pointer-events-auto"
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      </div>

                                      {/* Status */}
                                      <div className="space-y-2">
                                        <Label>Status</Label>
                                        <RadioGroup
                                          value={dadosIsolamentos[infeccao.id]?.status || 'Suspeito'}
                                          onValueChange={(value) => handleDadosChange(infeccao.id, 'status', value)}
                                        >
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Suspeito" id={`suspeito-${infeccao.id}`} />
                                            <Label htmlFor={`suspeito-${infeccao.id}`}>Suspeito</Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Confirmado" id={`confirmado-${infeccao.id}`} />
                                            <Label htmlFor={`confirmado-${infeccao.id}`}>Confirmado</Label>
                                          </div>
                                        </RadioGroup>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={() => (etapa === 1 ? handleClose() : setEtapa(1))}
              disabled={loading}
            >
              Voltar
            </Button>
            <Button
              onClick={handleSalvarIsolamentos}
              disabled={loading || etapa !== 2 || infeccoesSelecionadas.length === 0}
            >
              Salvar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GerenciarIsolamentosModal;