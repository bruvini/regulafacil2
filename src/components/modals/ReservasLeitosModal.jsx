import React, { useState, useEffect, useMemo } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CalendarIcon, 
  Info, 
  X, 
  BedDouble, 
  UserCheck, 
  Clock,
  Plus,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getReservasExternasCollection,
  getLeitosCollection,
  getPacientesCollection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  db,
  deleteField
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { ESPECIALIDADES_MEDICAS, ESPECIALIDADES_ONCOLOGIA } from '@/lib/constants';

// Sub-modais
import InformacoesReservaModal from './InformacoesReservaModal';
import SelecionarLeitoModal from './SelecionarLeitoModal';
import CancelarReservaModal from './CancelarReservaModal';
import ConfirmarInternacaoModal from './ConfirmarInternacaoModal';

const ReservasLeitosModal = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [dados, setDados] = useState({
    reservas: [],
    leitos: [],
    pacientes: [],
    loading: true
  });

  // Estados dos sub-modais
  const [subModals, setSubModals] = useState({
    informacoes: { open: false, reserva: null },
    selecionarLeito: { open: false, reserva: null },
    cancelarReserva: { open: false, reserva: null },
    confirmarInternacao: { open: false, reserva: null }
  });

  // Estado do formulário de nova reserva
  const [novaReserva, setNovaReserva] = useState({
    nomeCompleto: '',
    dataNascimento: null,
    sexo: '',
    isolamento: 'NÃO',
    origem: '',
    // Campos SISREG
    idSolicitacao: '',
    instituicaoOrigem: '',
    cidadeOrigem: '',
    dataSolicitacao: null,
    // Campos ONCOLOGIA
    especialidadeOncologia: '',
    telefoneContato: '',
    dataPrevistaInternacao: null
  });

  // Carregar dados
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribes = [];

    // Reservas Externas
    const unsubReservas = onSnapshot(getReservasExternasCollection(), (snapshot) => {
      const reservasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, reservas: reservasData }));
    });
    unsubscribes.push(unsubReservas);

    // Leitos
    const unsubLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, leitos: leitosData }));
    });
    unsubscribes.push(unsubLeitos);

    // Pacientes
    const unsubPacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, pacientes: pacientesData, loading: false }));
    });
    unsubscribes.push(unsubPacientes);

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [isOpen]);

  // Processar dados das reservas
  const reservasProcessadas = useMemo(() => {
    const ativas = dados.reservas.filter(r => r.status === 'Ativa');
    return {
      sisreg: ativas.filter(r => r.origem === 'SISREG'),
      oncologia: ativas.filter(r => r.origem === 'ONCOLOGIA')
    };
  }, [dados.reservas]);

  const resetForm = () => {
    setNovaReserva({
      nomeCompleto: '',
      dataNascimento: null,
      sexo: '',
      isolamento: 'NÃO',
      origem: '',
      idSolicitacao: '',
      instituicaoOrigem: '',
      cidadeOrigem: '',
      dataSolicitacao: null,
      especialidadeOncologia: '',
      telefoneContato: '',
      dataPrevistaInternacao: null
    });
  };

  const handleSubmitNovaReserva = async () => {
    try {
      // Validações básicas
      if (!novaReserva.nomeCompleto || !novaReserva.dataNascimento || !novaReserva.sexo || !novaReserva.origem) {
        toast({
          title: "Erro",
          description: "Por favor, preencha todos os campos obrigatórios.",
          variant: "destructive"
        });
        return;
      }

      // Validações específicas por origem
      if (novaReserva.origem === 'SISREG') {
        if (!novaReserva.idSolicitacao || !novaReserva.instituicaoOrigem || !novaReserva.cidadeOrigem || !novaReserva.dataSolicitacao) {
          toast({
            title: "Erro", 
            description: "Por favor, preencha todos os campos obrigatórios do SISREG.",
            variant: "destructive"
          });
          return;
        }
      }

      if (novaReserva.origem === 'ONCOLOGIA') {
        if (!novaReserva.especialidadeOncologia || !novaReserva.telefoneContato || !novaReserva.dataPrevistaInternacao) {
          toast({
            title: "Erro",
            description: "Por favor, preencha todos os campos obrigatórios da ONCOLOGIA.", 
            variant: "destructive"
          });
          return;
        }
      }

      // Criar documento da reserva
      const reservaData = {
        nomeCompleto: novaReserva.nomeCompleto,
        dataNascimento: novaReserva.dataNascimento,
        sexo: novaReserva.sexo,
        isolamento: novaReserva.isolamento,
        origem: novaReserva.origem,
        status: 'Ativa',
        leitoReservadoId: null,
        observacoes: [],
        criadoEm: serverTimestamp()
      };

      // Adicionar campos específicos por origem
      if (novaReserva.origem === 'SISREG') {
        reservaData.idSolicitacao = novaReserva.idSolicitacao;
        reservaData.instituicaoOrigem = novaReserva.instituicaoOrigem;
        reservaData.cidadeOrigem = novaReserva.cidadeOrigem;
        reservaData.dataSolicitacao = novaReserva.dataSolicitacao;
      } else {
        reservaData.especialidadeOncologia = novaReserva.especialidadeOncologia;
        reservaData.telefoneContato = novaReserva.telefoneContato;
        reservaData.dataPrevistaInternacao = novaReserva.dataPrevistaInternacao;
      }

      await addDoc(getReservasExternasCollection(), reservaData);

      // Log de auditoria
      await logAction(
        'Reservas de Leitos',
        `Nova reserva criada: ${novaReserva.nomeCompleto} (${novaReserva.origem})`
      );

      toast({
        title: "Sucesso",
        description: "Reserva criada com sucesso!"
      });

      resetForm();
    } catch (error) {
      console.error('Erro ao criar reserva:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar reserva. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const openSubModal = (type, reserva = null) => {
    setSubModals(prev => ({
      ...prev,
      [type]: { open: true, reserva }
    }));
  };

  const closeSubModal = (type) => {
    setSubModals(prev => ({
      ...prev,
      [type]: { open: false, reserva: null }
    }));
  };

  if (dados.loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">Carregando...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-primary" />
              Reservas de Leitos
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="visualizar" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="visualizar">Visualizar Reservas</TabsTrigger>
              <TabsTrigger value="criar">Nova Reserva</TabsTrigger>
            </TabsList>

            <TabsContent value="visualizar" className="space-y-4">
              <Accordion type="single" collapsible className="w-full space-y-4">
                <AccordionItem value="sisreg">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      SISREG 
                      <Badge variant="secondary">{reservasProcessadas.sisreg.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {reservasProcessadas.sisreg.length === 0 ? (
                      <p className="text-muted-foreground">Nenhuma reserva ativa do SISREG.</p>
                    ) : (
                      <div className="space-y-3">
                        {reservasProcessadas.sisreg.map(reserva => (
                          <ReservaCard 
                            key={reserva.id} 
                            reserva={reserva} 
                            onOpenSubModal={openSubModal}
                          />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="oncologia">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      ONCOLOGIA 
                      <Badge variant="secondary">{reservasProcessadas.oncologia.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {reservasProcessadas.oncologia.length === 0 ? (
                      <p className="text-muted-foreground">Nenhuma reserva ativa da ONCOLOGIA.</p>
                    ) : (
                      <div className="space-y-3">
                        {reservasProcessadas.oncologia.map(reserva => (
                          <ReservaCard 
                            key={reserva.id} 
                            reserva={reserva} 
                            onOpenSubModal={openSubModal}
                          />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="criar" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Nova Reserva Externa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Campos básicos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nomeCompleto">Nome Completo *</Label>
                      <Input
                        id="nomeCompleto"
                        value={novaReserva.nomeCompleto}
                        onChange={(e) => setNovaReserva(prev => ({ ...prev, nomeCompleto: e.target.value }))}
                        placeholder="Nome completo do paciente"
                      />
                    </div>

                    <div>
                      <Label>Data de Nascimento *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !novaReserva.dataNascimento && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {novaReserva.dataNascimento ? (
                              format(novaReserva.dataNascimento, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione a data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={novaReserva.dataNascimento}
                            onSelect={(date) => setNovaReserva(prev => ({ ...prev, dataNascimento: date }))}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Sexo *</Label>
                      <Select 
                        value={novaReserva.sexo} 
                        onValueChange={(value) => setNovaReserva(prev => ({ ...prev, sexo: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o sexo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Masculino">Masculino</SelectItem>
                          <SelectItem value="Feminino">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="isolamento">Isolamento</Label>
                      <Input
                        id="isolamento"
                        value={novaReserva.isolamento}
                        onChange={(e) => setNovaReserva(prev => ({ ...prev, isolamento: e.target.value }))}
                        placeholder="NÃO"
                      />
                    </div>

                    <div>
                      <Label>Origem *</Label>
                      <Select 
                        value={novaReserva.origem} 
                        onValueChange={(value) => setNovaReserva(prev => ({ ...prev, origem: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a origem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SISREG">SISREG</SelectItem>
                          <SelectItem value="ONCOLOGIA">ONCOLOGIA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Campos condicionais por origem */}
                  {novaReserva.origem === 'SISREG' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/50">
                      <h4 className="col-span-full font-semibold">Dados do SISREG</h4>
                      
                      <div>
                        <Label htmlFor="idSolicitacao">ID da Solicitação *</Label>
                        <Input
                          id="idSolicitacao"
                          value={novaReserva.idSolicitacao}
                          onChange={(e) => setNovaReserva(prev => ({ ...prev, idSolicitacao: e.target.value }))}
                          placeholder="CNS ou nº da solicitação"
                        />
                      </div>

                      <div>
                        <Label htmlFor="instituicaoOrigem">Instituição de Origem *</Label>
                        <Input
                          id="instituicaoOrigem"
                          value={novaReserva.instituicaoOrigem}
                          onChange={(e) => setNovaReserva(prev => ({ ...prev, instituicaoOrigem: e.target.value }))}
                          placeholder="Ex: UPA Leste"
                        />
                      </div>

                      <div>
                        <Label htmlFor="cidadeOrigem">Cidade de Origem *</Label>
                        <Input
                          id="cidadeOrigem"
                          value={novaReserva.cidadeOrigem}
                          onChange={(e) => setNovaReserva(prev => ({ ...prev, cidadeOrigem: e.target.value }))}
                          placeholder="Ex: Joinville"
                        />
                      </div>

                      <div>
                        <Label>Data da Solicitação *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !novaReserva.dataSolicitacao && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {novaReserva.dataSolicitacao ? (
                                format(novaReserva.dataSolicitacao, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione a data</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={novaReserva.dataSolicitacao}
                              onSelect={(date) => setNovaReserva(prev => ({ ...prev, dataSolicitacao: date }))}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  {novaReserva.origem === 'ONCOLOGIA' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/50">
                      <h4 className="col-span-full font-semibold">Dados da Oncologia</h4>
                      
                      <div>
                        <Label>Especialidade *</Label>
                        <Select 
                          value={novaReserva.especialidadeOncologia} 
                          onValueChange={(value) => setNovaReserva(prev => ({ ...prev, especialidadeOncologia: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a especialidade" />
                          </SelectTrigger>
                          <SelectContent>
                            {ESPECIALIDADES_ONCOLOGIA.map(esp => (
                              <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="telefoneContato">Telefone de Contato *</Label>
                        <Input
                          id="telefoneContato"
                          value={novaReserva.telefoneContato}
                          onChange={(e) => setNovaReserva(prev => ({ ...prev, telefoneContato: e.target.value }))}
                          placeholder="Ex: (47) 99999-9999"
                        />
                      </div>

                      <div>
                        <Label>Data Prevista para Internação *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !novaReserva.dataPrevistaInternacao && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {novaReserva.dataPrevistaInternacao ? (
                                format(novaReserva.dataPrevistaInternacao, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione a data</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={novaReserva.dataPrevistaInternacao}
                              onSelect={(date) => setNovaReserva(prev => ({ ...prev, dataPrevistaInternacao: date }))}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSubmitNovaReserva}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Reserva
                    </Button>
                    <Button variant="outline" onClick={resetForm}>
                      Limpar Formulário
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-modais */}
      <InformacoesReservaModal 
        isOpen={subModals.informacoes.open}
        onClose={() => closeSubModal('informacoes')}
        reserva={subModals.informacoes.reserva}
      />

      <SelecionarLeitoModal
        isOpen={subModals.selecionarLeito.open} 
        onClose={() => closeSubModal('selecionarLeito')}
        reserva={subModals.selecionarLeito.reserva}
        leitos={dados.leitos}
      />

      <CancelarReservaModal
        isOpen={subModals.cancelarReserva.open}
        onClose={() => closeSubModal('cancelarReserva')} 
        reserva={subModals.cancelarReserva.reserva}
      />

      <ConfirmarInternacaoModal
        isOpen={subModals.confirmarInternacao.open}
        onClose={() => closeSubModal('confirmarInternacao')}
        reserva={subModals.confirmarInternacao.reserva}
      />
    </>
  );
};

// Componente para cada card de reserva
const ReservaCard = ({ reserva, onOpenSubModal }) => {
  const handleCancelarPedido = async () => {
    try {
      await updateDoc(doc(db, 'artifacts/regulafacil/public/data/reservasExternas', reserva.id), {
        status: 'Cancelada'
      });

      await logAction(
        'Reservas de Leitos',
        `Pedido cancelado: ${reserva.nomeCompleto}`
      );

      toast({
        title: "Sucesso",
        description: "Pedido cancelado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao cancelar pedido:', error);
      toast({
        title: "Erro", 
        description: "Erro ao cancelar pedido. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const { toast } = useToast();

  return (
    <Card className="p-4">
      <div className="flex flex-col space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-semibold text-lg">{reserva.nomeCompleto}</h4>
            <p className="text-sm text-muted-foreground">
              {reserva.sexo} • {reserva.dataNascimento && format(reserva.dataNascimento.toDate(), 'dd/MM/yyyy')}
            </p>
            {reserva.isolamento !== 'NÃO' && (
              <Badge variant="destructive" className="mt-1">
                Isolamento: {reserva.isolamento}
              </Badge>
            )}
          </div>
          
          {reserva.leitoReservadoId && (
            <Badge variant="outline">
              Leito Reservado
            </Badge>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          {reserva.origem === 'SISREG' ? (
            <p>{reserva.instituicaoOrigem}, {reserva.cidadeOrigem}</p>
          ) : (
            <p>{reserva.especialidadeOncologia} • Tel: {reserva.telefoneContato}</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onOpenSubModal('informacoes', reserva)}
          >
            <Info className="h-4 w-4 mr-1" />
            Informações
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleCancelarPedido}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Cancelar Pedido
          </Button>

          {!reserva.leitoReservadoId ? (
            <Button 
              size="sm"
              onClick={() => onOpenSubModal('selecionarLeito', reserva)}
            >
              <BedDouble className="h-4 w-4 mr-1" />
              Reservar Leito
            </Button>
          ) : (
            <>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => onOpenSubModal('cancelarReserva', reserva)}
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar Reserva
              </Button>
              <Button 
                size="sm"
                onClick={() => onOpenSubModal('confirmarInternacao', reserva)}
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Confirmar Internação
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ReservasLeitosModal;