import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { differenceInHours, format, isValid, parse } from 'date-fns';
import {
  CalendarIcon,
  Info,
  X,
  BedDouble,
  UserCheck,
  AlertTriangle,
  Plus,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getReservasExternasCollection,
  getLeitosCollection,
  getPacientesCollection,
  getSetoresCollection,
  getQuartosCollection,
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
import CancelarReservaExternaModal from './CancelarReservaExternaModal';
import ConfirmarInternacaoExternaModal from './ConfirmarInternacaoExternaModal';

const ReservasLeitosModal = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [dados, setDados] = useState({
    reservas: [],
    leitos: [],
    pacientes: [],
    setores: [],
    quartos: [],
    loading: true
  });

  // Estados dos sub-modais
  const [subModals, setSubModals] = useState({
    informacoes: { open: false, reserva: null, leito: null },
    selecionarLeito: { open: false, reserva: null, leito: null },
    cancelarReserva: { open: false, reserva: null, leito: null },
    confirmarInternacao: { open: false, reserva: null, leito: null }
  });

  // Estado do formulário de nova reserva
  const [novaReserva, setNovaReserva] = useState({
    nomeCompleto: '',
    dataNascimento: null,
    dataNascimentoTexto: '',
    sexo: '',
    isolamento: 'NÃO',
    origem: '',
    // Campos SISREG
    idSolicitacao: '',
    instituicaoOrigem: '',
    cidadeOrigem: '',
    dataSolicitacao: null,
    dataSolicitacaoTexto: '',
    // Campos ONCOLOGIA
    especialidadeOncologia: '',
    telefoneContato: '',
    dataPrevistaInternacao: null,
    dataPrevistaInternacaoTexto: ''
  });

  const [calendariosAbertos, setCalendariosAbertos] = useState({
    dataNascimento: false,
    dataSolicitacao: false,
    dataPrevistaInternacao: false
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

    const unsubSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, setores: setoresData }));
    });
    unsubscribes.push(unsubSetores);

    const unsubQuartos = onSnapshot(getQuartosCollection(), (snapshot) => {
      const quartosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, quartos: quartosData }));
    });
    unsubscribes.push(unsubQuartos);

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
    const ativas = dados.reservas.filter(r => !['Cancelada', 'Cancelado', 'Internado'].includes(r.status));
    return {
      sisreg: ativas.filter(r => r.origem === 'SISREG'),
      oncologia: ativas.filter(r => r.origem === 'ONCOLOGIA')
    };
  }, [dados.reservas]);

  const resetForm = () => {
    setNovaReserva({
      nomeCompleto: '',
      dataNascimento: null,
      dataNascimentoTexto: '',
      sexo: '',
      isolamento: 'NÃO',
      origem: '',
      idSolicitacao: '',
      instituicaoOrigem: '',
      cidadeOrigem: '',
      dataSolicitacao: null,
      dataSolicitacaoTexto: '',
      especialidadeOncologia: '',
      telefoneContato: '',
      dataPrevistaInternacao: null,
      dataPrevistaInternacaoTexto: ''
    });
    setCalendariosAbertos({
      dataNascimento: false,
      dataSolicitacao: false,
      dataPrevistaInternacao: false
    });
  };

  const atualizarCampoData = useCallback((campo, valor) => {
    setNovaReserva(prev => ({
      ...prev,
      [campo]: valor,
      [`${campo}Texto`]: valor ? format(valor, 'dd/MM/yyyy') : ''
    }));
  }, []);

  const handleInputData = useCallback((campo, valor) => {
    setNovaReserva(prev => {
      const proximo = { ...prev, [`${campo}Texto`]: valor };

      if (!valor) {
        proximo[campo] = null;
        return proximo;
      }

      const dataParseada = parse(valor, 'dd/MM/yyyy', new Date());
      if (isValid(dataParseada)) {
        proximo[campo] = dataParseada;
        proximo[`${campo}Texto`] = format(dataParseada, 'dd/MM/yyyy');
      } else {
        proximo[campo] = null;
      }

      return proximo;
    });
  }, []);

  const handleSelecionarData = useCallback((campo, data) => {
    atualizarCampoData(campo, data ?? null);
    setCalendariosAbertos(prev => ({ ...prev, [campo]: false }));
  }, [atualizarCampoData]);

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
        status: 'Aguardando Leito',
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
    const leitoRelacionado = reserva?.leitoReservadoId
      ? dados.leitos.find(item => item.id === reserva.leitoReservadoId) || null
      : null;

    setSubModals(prev => ({
      ...prev,
      [type]: { open: true, reserva, leito: leitoRelacionado }
    }));
  };

  const closeSubModal = (type) => {
    setSubModals(prev => ({
      ...prev,
      [type]: { open: false, reserva: null, leito: null }
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
                            leitos={dados.leitos}
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
                            leitos={dados.leitos}
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
                      <div className="relative">
                        <CalendarIcon className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
                        <Popover
                          open={calendariosAbertos.dataNascimento}
                          onOpenChange={(open) => setCalendariosAbertos(prev => ({ ...prev, dataNascimento: open }))}
                        >
                          <PopoverTrigger asChild>
                            <Input
                              value={novaReserva.dataNascimentoTexto}
                              placeholder="dd/mm/aaaa"
                              onFocus={() => setCalendariosAbertos(prev => ({ ...prev, dataNascimento: true }))}
                              onInput={(event) => handleInputData('dataNascimento', event.target.value)}
                              className="pl-8"
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={novaReserva.dataNascimento}
                              onSelect={(date) => handleSelecionarData('dataNascimento', date)}
                              initialFocus
                              captionLayout="dropdown-buttons"
                              fromYear={1920}
                              toYear={new Date().getFullYear()}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
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
                        <div className="relative">
                          <CalendarIcon className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
                          <Popover
                            open={calendariosAbertos.dataSolicitacao}
                            onOpenChange={(open) => setCalendariosAbertos(prev => ({ ...prev, dataSolicitacao: open }))}
                          >
                            <PopoverTrigger asChild>
                              <Input
                                value={novaReserva.dataSolicitacaoTexto}
                                placeholder="dd/mm/aaaa"
                                onFocus={() => setCalendariosAbertos(prev => ({ ...prev, dataSolicitacao: true }))}
                                onInput={(event) => handleInputData('dataSolicitacao', event.target.value)}
                                className="pl-8"
                              />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={novaReserva.dataSolicitacao}
                                onSelect={(date) => handleSelecionarData('dataSolicitacao', date)}
                                initialFocus
                                captionLayout="dropdown-buttons"
                                fromYear={1920}
                                toYear={new Date().getFullYear()}
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
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
                        <div className="relative">
                          <CalendarIcon className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
                          <Popover
                            open={calendariosAbertos.dataPrevistaInternacao}
                            onOpenChange={(open) => setCalendariosAbertos(prev => ({ ...prev, dataPrevistaInternacao: open }))}
                          >
                            <PopoverTrigger asChild>
                              <Input
                                value={novaReserva.dataPrevistaInternacaoTexto}
                                placeholder="dd/mm/aaaa"
                                onFocus={() => setCalendariosAbertos(prev => ({ ...prev, dataPrevistaInternacao: true }))}
                                onInput={(event) => handleInputData('dataPrevistaInternacao', event.target.value)}
                                className="pl-8"
                              />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={novaReserva.dataPrevistaInternacao}
                                onSelect={(date) => handleSelecionarData('dataPrevistaInternacao', date)}
                                initialFocus
                                captionLayout="dropdown-buttons"
                                fromYear={1920}
                                toYear={new Date().getFullYear()}
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
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
        dadosHospital={{
          leitos: dados.leitos,
          setores: dados.setores,
          quartos: dados.quartos,
          pacientes: dados.pacientes,
          loading: dados.loading
        }}
      />

      <CancelarReservaExternaModal
        isOpen={subModals.cancelarReserva.open}
        onClose={() => closeSubModal('cancelarReserva')}
        reserva={subModals.cancelarReserva.reserva}
        leito={subModals.cancelarReserva.leito}
      />

      <ConfirmarInternacaoExternaModal
        isOpen={subModals.confirmarInternacao.open}
        onClose={() => closeSubModal('confirmarInternacao')}
        reserva={subModals.confirmarInternacao.reserva}
        leito={subModals.confirmarInternacao.leito}
      />
    </>
  );
};

// Componente para cada card de reserva
const ReservaCard = ({ reserva, onOpenSubModal, leitos }) => {
  const { toast } = useToast();
  const [confirmacaoCancelarOpen, setConfirmacaoCancelarOpen] = useState(false);

  const obterData = (valor) => {
    if (!valor) return null;
    if (typeof valor?.toDate === 'function') {
      return valor.toDate();
    }
    if (valor instanceof Date) {
      return valor;
    }
    const parseado = new Date(valor);
    return Number.isNaN(parseado.getTime()) ? null : parseado;
  };

  const dataNascimento = obterData(reserva.dataNascimento);
  const dataSolicitacao = obterData(reserva.dataSolicitacao);
  const dataPrevista = obterData(reserva.dataPrevistaInternacao);

  const atrasoOncologia =
    reserva.origem === 'ONCOLOGIA' && dataPrevista && dataPrevista < new Date();

  const instituicaoUpper = (reserva.instituicaoOrigem || '').toUpperCase();
  const atrasoInstituicao =
    ['HRHDS', 'REGIONAL'].includes(instituicaoUpper) &&
    dataSolicitacao &&
    differenceInHours(new Date(), dataSolicitacao) > 72;

  const leitoReservado = useMemo(() => {
    if (!reserva.leitoReservadoId) return null;
    const listaLeitos = Array.isArray(leitos) ? leitos : [];
    return listaLeitos.find(leitoAtual => leitoAtual.id === reserva.leitoReservadoId) || null;
  }, [leitos, reserva.leitoReservadoId]);

  const alertas = [];
  if (atrasoOncologia) {
    alertas.push({
      tipo: 'critico',
      mensagem: 'Data prevista de internação já passou.'
    });
  }
  if (atrasoInstituicao) {
    alertas.push({
      tipo: 'alerta',
      mensagem: `Solicitação da instituição ${instituicaoUpper} está aguardando há mais de 72 horas.`
    });
  }

  const cardClasses = ['p-4'];
  if (atrasoOncologia && atrasoInstituicao) {
    cardClasses.push('border-2 border-destructive/60 bg-destructive/10 shadow-sm');
  } else if (atrasoOncologia) {
    cardClasses.push('border-2 border-destructive/60 bg-destructive/5 shadow-sm');
  } else if (atrasoInstituicao) {
    cardClasses.push('border-2 border-amber-400/70 bg-amber-50/60 shadow-sm');
  }

  const statusStyles = {
    'Aguardando Leito': 'border-blue-200 bg-blue-50 text-blue-700',
    'Reservado': 'border-sky-200 bg-sky-50 text-sky-700',
    'Cancelada': 'border-destructive/30 bg-destructive/10 text-destructive',
    'Internado': 'border-emerald-200 bg-emerald-50 text-emerald-700'
  };
  const statusBadgeClass = statusStyles[reserva.status] || 'border-muted bg-muted/20 text-muted-foreground';

  const handleCancelarPedido = async () => {
    try {
      await updateDoc(
        doc(db, 'artifacts/regulafacil/public/data/reservasExternas', reserva.id),
        {
          status: 'Cancelada',
          leitoReservadoId: deleteField()
        }
      );

      await logAction(
        'Reservas de Leitos',
        `Pedido cancelado: ${reserva.nomeCompleto}`
      );

      toast({
        title: 'Solicitação cancelada',
        description: 'Pedido cancelado com sucesso!'
      });
      setConfirmacaoCancelarOpen(false);
    } catch (error) {
      console.error('Erro ao cancelar pedido:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao cancelar pedido. Tente novamente.',
        variant: 'destructive'
      });
    }
  };

  return (
    <>
      <Card className={cardClasses.join(' ')}>
        <div className="flex flex-col space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-lg">{reserva.nomeCompleto}</h4>
              <p className="text-sm text-muted-foreground">
                {reserva.sexo} • {dataNascimento ? format(dataNascimento, 'dd/MM/yyyy') : 'Data não informada'}
              </p>
              {reserva.isolamento !== 'NÃO' && (
                <Badge variant="destructive" className="mt-1">
                  Isolamento: {reserva.isolamento}
                </Badge>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className={statusBadgeClass}>
                {reserva.status || 'Status desconhecido'}
              </Badge>
              {reserva.leitoReservadoId && (
                <Badge variant="outline">
                  Leito: {leitoReservado?.codigoLeito || '...'}
                </Badge>
              )}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {reserva.origem === 'SISREG' ? (
              <p>{reserva.instituicaoOrigem}, {reserva.cidadeOrigem}</p>
            ) : (
              <p>{reserva.especialidadeOncologia} • Tel: {reserva.telefoneContato}</p>
            )}
          </div>

          {alertas.length > 0 && (
            <div className="space-y-2">
              {alertas.map((alerta, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                    alerta.tipo === 'critico'
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : 'border-amber-300 bg-amber-50 text-amber-800'
                  }`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{alerta.mensagem}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenSubModal('informacoes', reserva)}
            >
              <Info className="h-4 w-4 mr-1" />
              Informações
            </Button>

            {!reserva.leitoReservadoId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmacaoCancelarOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Cancelar Solicitação
              </Button>
            )}

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

      <AlertDialog open={confirmacaoCancelarOpen} onOpenChange={setConfirmacaoCancelarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja cancelar a solicitação para o paciente <strong>{reserva.nomeCompleto}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarPedido}>
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ReservasLeitosModal;