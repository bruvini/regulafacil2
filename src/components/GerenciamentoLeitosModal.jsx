import React, { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  getSetoresCollection,
  getLeitosCollection,
  getQuartosCollection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  serverTimestamp
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';

const GerenciamentoLeitosModal = ({ isOpen, onClose }) => {
  // Estados para dados
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [quartos, setQuartos] = useState([]);
  const [loading, setLoading] = useState({
    setores: false,
    leitos: false,
    quartos: false
  });

  // Estados para formulários
  const [setorForm, setSetorForm] = useState({
    id: '',
    nomeSetor: '',
    siglaSetor: '',
    tipoSetor: ''
  });

  const [leitoForm, setLeitoForm] = useState({
    setorId: '',
    codigosLeitos: '',
    isPCP: false
  });

  const [quartoForm, setQuartoForm] = useState({
    id: '',
    nomeQuarto: '',
    setorId: '',
    leitosIds: []
  });

  const [leitoSearch, setLeitoSearch] = useState('');

  const [activeTab, setActiveTab] = useState('setores');
  const [editingSetor, setEditingSetor] = useState(null);
  const [itemEmEdicao, setItemEmEdicao] = useState(null);
  const isEditandoLeito = itemEmEdicao?.tipo === 'leito';
  const isEditandoQuarto = itemEmEdicao?.tipo === 'quarto';
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // Listeners em tempo real
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSetores(setoresData);
    });

    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeitos(leitosData);
    });

    const unsubscribeQuartos = onSnapshot(getQuartosCollection(), (snapshot) => {
      const quartosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQuartos(quartosData);
    });

    return () => {
      unsubscribeSetores();
      unsubscribeLeitos();
      unsubscribeQuartos();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setItemEmEdicao(null);
      setLeitoForm({ setorId: '', codigosLeitos: '', isPCP: false });
      setQuartoForm({ id: '', nomeQuarto: '', setorId: '', leitosIds: [] });
      setLeitoSearch('');
    }
  }, [isOpen]);

  // Funções CRUD para Setores
  const handleSetorSubmit = async (e) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, setores: true }));

    try {
      const setorData = {
        nomeSetor: setorForm.nomeSetor,
        siglaSetor: setorForm.siglaSetor,
        tipoSetor: setorForm.tipoSetor
      };

      if (editingSetor) {
        await setDoc(doc(getSetoresCollection(), editingSetor), setorData);
        toast({ title: "Setor atualizado com sucesso!" });
        await logAction('Gerenciamento de Leitos', `Setor '${setorData.nomeSetor}' foi atualizado.`, currentUser);
        setEditingSetor(null);
      } else {
        await addDoc(getSetoresCollection(), setorData);
        toast({ title: "Setor criado com sucesso!" });
        await logAction('Gerenciamento de Leitos', `Setor '${setorData.nomeSetor}' foi criado.`, currentUser);
      }

      setSetorForm({ id: '', nomeSetor: '', siglaSetor: '', tipoSetor: '' });
    } catch (error) {
      toast({ 
        title: "Erro ao salvar setor", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(prev => ({ ...prev, setores: false }));
    }
  };

  const handleEditSetor = (setor) => {
    setSetorForm({
      id: setor.id,
      nomeSetor: setor.nomeSetor,
      siglaSetor: setor.siglaSetor,
      tipoSetor: setor.tipoSetor
    });
    setEditingSetor(setor.id);
  };

  const handleDeleteSetor = async (setorId) => {
    if (!confirm('Tem certeza que deseja excluir este setor?')) return;

    setLoading(prev => ({ ...prev, setores: true }));
    try {
      const setor = setores.find(s => s.id === setorId);
      await deleteDoc(doc(getSetoresCollection(), setorId));
      toast({ title: "Setor excluído com sucesso!" });
      await logAction('Gerenciamento de Leitos', `Setor '${setor?.nomeSetor || setorId}' foi excluído.`, currentUser);
    } catch (error) {
      toast({ 
        title: "Erro ao excluir setor", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(prev => ({ ...prev, setores: false }));
    }
  };

  // Funções CRUD para Leitos
  const handleLeitoSubmit = async (e) => {
    e.preventDefault();
    if (!leitoForm.setorId) {
      toast({ 
        title: "Erro", 
        description: "Selecione um setor",
        variant: "destructive" 
      });
      return;
    }

    const codigos = leitoForm.codigosLeitos
      .split(',')
      .map(code => code.trim())
      .filter(code => code);

    if (isEditandoLeito && codigos.length !== 1) {
      toast({
        title: "Edição inválida",
        description: "Informe apenas um código de leito ao editar.",
        variant: "destructive"
      });
      return;
    }

    setLoading(prev => ({ ...prev, leitos: true }));

    try {
      if (isEditandoLeito) {
        const codigo = codigos[0] || '';
        const leitoRef = doc(getLeitosCollection(), itemEmEdicao.id);
        await updateDoc(leitoRef, {
          codigoLeito: codigo,
          setorId: leitoForm.setorId,
          isPCP: leitoForm.isPCP
        });

        toast({ title: "Leito atualizado com sucesso!" });
        await logAction(
          'Gerenciamento de Leitos',
          `Leito '${codigo || itemEmEdicao.codigoLeito}' foi atualizado.`
        );
      } else {
        for (const codigo of codigos) {
          const leitoData = {
            codigoLeito: codigo,
            setorId: leitoForm.setorId,
            status: "Vago",
            isPCP: codigos.length === 1 ? leitoForm.isPCP : false,
            historico: [{ status: 'Vago', timestamp: new Date() }]
          };
          await addDoc(getLeitosCollection(), leitoData);
        }

        const setorNome = setores.find(s => s.id === leitoForm.setorId)?.nomeSetor || leitoForm.setorId;
        toast({ title: `${codigos.length} leito(s) criado(s) com sucesso!` });
        await logAction('Gerenciamento de Leitos', `${codigos.length} leito(s) foram criados no setor '${setorNome}'.`, currentUser);
      }

      setLeitoForm({ setorId: '', codigosLeitos: '', isPCP: false });
      setItemEmEdicao(null);
    } catch (error) {
      toast({
        title: "Erro ao salvar leito(s)",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, leitos: false }));
    }
  };

  const handleEditLeito = (leito) => {
    setActiveTab('leitos');
    setLeitoForm({
      setorId: leito.setorId || '',
      codigosLeitos: leito.codigoLeito || '',
      isPCP: !!leito.isPCP
    });
    setItemEmEdicao({ ...leito, tipo: 'leito' });
  };

  const handleCancelarEdicaoLeito = () => {
    setItemEmEdicao(null);
    setLeitoForm({ setorId: '', codigosLeitos: '', isPCP: false });
  };

  const handleDeleteLeito = async (leitoId) => {
    if (!confirm('Tem certeza que deseja excluir este leito?')) return;

    if (isEditandoLeito && itemEmEdicao.id === leitoId) {
      handleCancelarEdicaoLeito();
    }

    setLoading(prev => ({ ...prev, leitos: true }));
    try {
      const leito = leitos.find(l => l.id === leitoId);
      await deleteDoc(doc(getLeitosCollection(), leitoId));
      toast({ title: "Leito excluído com sucesso!" });
      await logAction('Gerenciamento de Leitos', `Leito '${leito?.codigoLeito || leitoId}' foi excluído.`, currentUser);
    } catch (error) {
      toast({ 
        title: "Erro ao excluir leito", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(prev => ({ ...prev, leitos: false }));
    }
  };

  // Funções CRUD para Quartos
  const handleQuartoSubmit = async (e) => {
    e.preventDefault();
    if (!quartoForm.setorId) {
      toast({ 
        title: "Erro", 
        description: "Selecione um setor",
        variant: "destructive" 
      });
      return;
    }

    setLoading(prev => ({ ...prev, quartos: true }));

    try {
      const quartoData = {
        nomeQuarto: quartoForm.nomeQuarto,
        setorId: quartoForm.setorId,
        leitosIds: quartoForm.leitosIds
      };

      if (isEditandoQuarto) {
        const quartoRef = doc(getQuartosCollection(), itemEmEdicao.id);
        await updateDoc(quartoRef, quartoData);
        toast({ title: "Quarto atualizado com sucesso!" });
        await logAction('Gerenciamento de Leitos', `Quarto '${quartoData.nomeQuarto}' foi atualizado.`, currentUser);
      } else {
        await addDoc(getQuartosCollection(), quartoData);
        toast({ title: "Quarto criado com sucesso!" });
        await logAction('Gerenciamento de Leitos', `Quarto '${quartoData.nomeQuarto}' foi criado.`, currentUser);
      }

      handleCancelarEdicaoQuarto();
    } catch (error) {
      toast({
        title: "Erro ao salvar quarto",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, quartos: false }));
    }
  };

  const handleEditQuarto = (quarto) => {
    setActiveTab('quartos');
    setQuartoForm({
      id: quarto.id,
      nomeQuarto: quarto.nomeQuarto,
      setorId: quarto.setorId,
      leitosIds: quarto.leitosIds || []
    });
    setLeitoSearch('');
    setItemEmEdicao({ ...quarto, tipo: 'quarto' });
  };

  const handleDeleteQuarto = async (quartoId) => {
    if (!confirm('Tem certeza que deseja excluir este quarto?')) return;

    if (isEditandoQuarto && itemEmEdicao.id === quartoId) {
      handleCancelarEdicaoQuarto();
    }

    setLoading(prev => ({ ...prev, quartos: true }));
    try {
      const quarto = quartos.find(q => q.id === quartoId);
      await deleteDoc(doc(getQuartosCollection(), quartoId));
      toast({ title: "Quarto excluído com sucesso!" });
      await logAction('Gerenciamento de Leitos', `Quarto '${quarto?.nomeQuarto || quartoId}' foi excluído.`, currentUser);
    } catch (error) {
      toast({
        title: "Erro ao excluir quarto",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, quartos: false }));
    }
  };

  // Função para obter leitos disponíveis para quartos
  const getLeitosDisponiveis = (setorId) => {
    if (!setorId) return [];
    const leitosDoSetor = leitos.filter(leito => leito.setorId === setorId);
    const quartoEmEdicaoId = isEditandoQuarto ? itemEmEdicao.id : null;
    const leitosEmQuartos = quartos.flatMap(quarto => {
      if (quarto.id === quartoEmEdicaoId) {
        return [];
      }
      return quarto.leitosIds || [];
    });
    return leitosDoSetor.filter(leito => !leitosEmQuartos.includes(leito.id));
  };

  const handleCancelarEdicaoQuarto = () => {
    setItemEmEdicao(null);
    setQuartoForm({ id: '', nomeQuarto: '', setorId: '', leitosIds: [] });
    setLeitoSearch('');
  };

  // Verificar se PCP deve estar habilitado
  const isPCPEnabled = () => {
    const codigos = leitoForm.codigosLeitos.split(',').map(code => code.trim()).filter(code => code);
    return codigos.length === 1;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-semibold">Gerenciamento de Leitos</h2>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="px-6 pt-6">
              <TabsList className="grid w-full grid-cols-2 gap-2">
                <TabsTrigger value="setores">Setores</TabsTrigger>
                <TabsTrigger value="leitos">Leitos</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {/* Aba Setores */}
              <TabsContent value="setores" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingSetor ? 'Editar Setor' : 'Novo Setor'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSetorSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="nomeSetor">Nome do Setor</Label>
                        <Input
                          id="nomeSetor"
                          value={setorForm.nomeSetor}
                          onChange={(e) => setSetorForm({...setorForm, nomeSetor: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="siglaSetor">Sigla do Setor</Label>
                        <Input
                          id="siglaSetor"
                          value={setorForm.siglaSetor}
                          onChange={(e) => setSetorForm({...setorForm, siglaSetor: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="tipoSetor">Tipo de Setor</Label>
                        <Select 
                          value={setorForm.tipoSetor} 
                          onValueChange={(value) => setSetorForm({...setorForm, tipoSetor: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Enfermaria">Enfermaria</SelectItem>
                            <SelectItem value="UTI">UTI</SelectItem>
                            <SelectItem value="Emergência">Emergência</SelectItem>
                            <SelectItem value="Centro Cirúrgico">Centro Cirúrgico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading.setores}>
                        {loading.setores && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Salvar
                      </Button>
                      {editingSetor && (
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => {
                            setEditingSetor(null);
                            setSetorForm({ id: '', nomeSetor: '', siglaSetor: '', tipoSetor: '' });
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Lista de Setores */}
              <Card>
                <CardHeader>
                  <CardTitle>Setores Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                  {setores.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum setor cadastrado ainda.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Nome</th>
                            <th className="text-left p-2">Sigla</th>
                            <th className="text-left p-2">Tipo</th>
                            <th className="text-left p-2">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {setores.map((setor) => (
                            <tr key={setor.id} className="border-b">
                              <td className="p-2">{setor.nomeSetor}</td>
                              <td className="p-2">{setor.siglaSetor}</td>
                              <td className="p-2">{setor.tipoSetor}</td>
                              <td className="p-2">
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditSetor(setor)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteSetor(setor.id)}
                                    disabled={loading.setores}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba Leitos */}
            <TabsContent value="leitos" className="space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-xs">
                  <Input
                    placeholder="Buscar leito pelo código"
                    value={leitoSearch}
                    onChange={(event) => setLeitoSearch(event.target.value)}
                  />
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{isEditandoLeito ? 'Editar Leito' : 'Novo(s) Leito(s)'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLeitoSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="setorLeito">Setor</Label>
                        <Select 
                          value={leitoForm.setorId} 
                          onValueChange={(value) => setLeitoForm({...leitoForm, setorId: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o setor" />
                          </SelectTrigger>
                          <SelectContent>
                            {setores.map((setor) => (
                              <SelectItem key={setor.id} value={setor.id}>
                                {setor.nomeSetor} ({setor.siglaSetor})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="isPCP"
                          checked={leitoForm.isPCP}
                          onCheckedChange={(checked) => setLeitoForm({...leitoForm, isPCP: checked})}
                          disabled={!isPCPEnabled()}
                        />
                        <Label htmlFor="isPCP">Leito PCP</Label>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="codigosLeitos">Códigos dos Leitos</Label>
                      <Textarea
                        id="codigosLeitos"
                        placeholder="Digite os códigos separados por vírgula (ex: L001, L002, L003)"
                        value={leitoForm.codigosLeitos}
                        onChange={(e) => setLeitoForm({...leitoForm, codigosLeitos: e.target.value})}
                        required
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        {isPCPEnabled() ? 
                          "Um único código: Checkbox PCP disponível" : 
                          "Múltiplos códigos: Checkbox PCP desabilitado"
                        }
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading.leitos}>
                        {loading.leitos && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditandoLeito ? (
                          <Save className="mr-2 h-4 w-4" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        {isEditandoLeito ? 'Salvar Leito' : 'Adicionar Leito(s)'}
                      </Button>
                      {isEditandoLeito && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelarEdicaoLeito}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Lista de Leitos */}
              <Card>
                <CardHeader>
                  <CardTitle>Leitos Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                  {leitos.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum leito cadastrado ainda.
                    </p>
                  ) : (
                    <Accordion type="multiple" className="space-y-4">
                      {Object.entries(
                        leitos.reduce((acc, leito) => {
                          if (!leito.setorId) {
                            return acc;
                          }

                          if (!acc[leito.setorId]) {
                            acc[leito.setorId] = [];
                          }

                          acc[leito.setorId].push(leito);
                          return acc;
                        }, {})
                      ).map(([setorId, grupoLeitos]) => {
                        const setor = setores.find((s) => s.id === setorId) || {};
                        const sortedLeitos = [...grupoLeitos].sort((a, b) =>
                          (a.codigoLeito || '').localeCompare(b.codigoLeito || '')
                        );
                        const termoBusca = leitoSearch.trim().toLowerCase();
                        const leitosFiltrados = termoBusca
                          ? sortedLeitos.filter((leito) =>
                              (leito.codigoLeito || '').toLowerCase().includes(termoBusca)
                            )
                          : sortedLeitos;

                        return (
                          <AccordionItem key={setorId} value={`setor-${setorId}`}>
                            <AccordionTrigger className="flex justify-between gap-4 text-left">
                              <div className="flex flex-1 items-center justify-between gap-4">
                                <div className="flex flex-col text-sm font-semibold">
                                  <span>
                                    {setor.nomeSetor || 'Setor não identificado'}
                                    {setor.siglaSetor ? ` (${setor.siglaSetor})` : ''}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                  {leitosFiltrados.length} {leitosFiltrados.length === 1 ? 'leito' : 'leitos'}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              {sortedLeitos.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum leito cadastrado neste setor.
                                </p>
                              ) : leitosFiltrados.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum leito encontrado para a busca.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {leitosFiltrados.map((leito) => (
                                    <div
                                      key={leito.id}
                                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="space-y-1">
                                        <p className="font-medium">
                                          {leito.codigoLeito || 'Código não informado'}
                                        </p>
                                        <div className="text-sm text-muted-foreground">
                                          <span className="mr-3">
                                            Status: {leito.status || 'Não informado'}
                                          </span>
                                          <span>PCP: {leito.isPCP ? 'Sim' : 'Não'}</span>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEditLeito(leito)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => handleDeleteLeito(leito.id)}
                                          disabled={loading.leitos}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            </div>

          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default GerenciamentoLeitosModal;