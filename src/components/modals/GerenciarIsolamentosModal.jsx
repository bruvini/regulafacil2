import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, UserSearch } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format } from 'date-fns';
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

const GerenciarIsolamentosModal = ({ isOpen, onClose, pacientes, infeccoes }) => {
  const [etapa, setEtapa] = useState(1); // 1: Selecionar Paciente, 2: Gerenciar Isolamentos
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [buscarPaciente, setBuscarPaciente] = useState('');
  const [showPacientes, setShowPacientes] = useState(false);
  
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
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {etapa === 1 ? 'Selecionar Paciente' : `Gerenciar Isolamentos - ${pacienteSelecionado?.nomePaciente}`}
          </DialogTitle>
        </DialogHeader>

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
                          <div key={isolamento.id} className="flex justify-between items-center p-2 bg-muted rounded">
                            <div>
                              <div className="font-medium">{infeccao?.nomeInfeccao || 'Infecção não encontrada'}</div>
                              <div className="text-sm text-muted-foreground">
                                Status: {isolamento.status} | 
                                Data: {format(new Date(isolamento.dataInclusao), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
                            </div>
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
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Adicionar Novos Isolamentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {infeccoes.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      Nenhuma infecção cadastrada. Cadastre infecções primeiro.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Label>Selecionar Infecções:</Label>
                      {infeccoes.map((infeccao) => (
                        <div key={infeccao.id} className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={infeccao.id}
                              checked={infeccoesSelecionadas.includes(infeccao.id)}
                              onCheckedChange={(checked) => handleInfeccaoChange(infeccao.id, checked)}
                            />
                            <Label htmlFor={infeccao.id} className="font-medium">
                              {infeccao.nomeInfeccao} ({infeccao.siglaInfeccao})
                            </Label>
                          </div>

                          {infeccoesSelecionadas.includes(infeccao.id) && (
                            <div className="ml-6 p-4 border rounded-lg space-y-4">
                              <div className="grid grid-cols-2 gap-4">
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
                                        {dadosIsolamentos[infeccao.id]?.dataInclusao ? 
                                          format(dadosIsolamentos[infeccao.id].dataInclusao, "dd/MM/yyyy", { locale: ptBR }) : 
                                          "Selecionar data"
                                        }
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
                      ))}

                      {infeccoesSelecionadas.length > 0 && (
                        <div className="flex gap-2 pt-4">
                          <Button onClick={handleSalvarIsolamentos} disabled={loading} className="flex-1">
                            Salvar Isolamentos
                          </Button>
                          <Button variant="outline" onClick={() => setEtapa(1)} disabled={loading}>
                            Voltar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GerenciarIsolamentosModal;