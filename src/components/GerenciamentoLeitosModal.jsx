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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  getSetoresCollection,
  getLeitosCollection,
  getQuartosCollection,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  serverTimestamp
} from '@/lib/firebase';

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
  const [editingQuarto, setEditingQuarto] = useState(null);
  const { toast } = useToast();

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
        setEditingSetor(null);
      } else {
        await addDoc(getSetoresCollection(), setorData);
        toast({ title: "Setor criado com sucesso!" });
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
      await deleteDoc(doc(getSetoresCollection(), setorId));
      toast({ title: "Setor excluído com sucesso!" });
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

    setLoading(prev => ({ ...prev, leitos: true }));

    try {
      const codigos = leitoForm.codigosLeitos.split(',').map(code => code.trim()).filter(code => code);
      
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

      toast({ title: `${codigos.length} leito(s) criado(s) com sucesso!` });
      setLeitoForm({ setorId: '', codigosLeitos: '', isPCP: false });
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

  const handleDeleteLeito = async (leitoId) => {
    if (!confirm('Tem certeza que deseja excluir este leito?')) return;

    setLoading(prev => ({ ...prev, leitos: true }));
    try {
      await deleteDoc(doc(getLeitosCollection(), leitoId));
      toast({ title: "Leito excluído com sucesso!" });
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

      if (editingQuarto) {
        await setDoc(doc(getQuartosCollection(), editingQuarto), quartoData);
        toast({ title: "Quarto atualizado com sucesso!" });
        setEditingQuarto(null);
      } else {
        await addDoc(getQuartosCollection(), quartoData);
        toast({ title: "Quarto criado com sucesso!" });
      }

      setQuartoForm({ id: '', nomeQuarto: '', setorId: '', leitosIds: [] });
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
    setQuartoForm({
      id: quarto.id,
      nomeQuarto: quarto.nomeQuarto,
      setorId: quarto.setorId,
      leitosIds: quarto.leitosIds || []
    });
    setEditingQuarto(quarto.id);
  };

  const handleDeleteQuarto = async (quartoId) => {
    if (!confirm('Tem certeza que deseja excluir este quarto?')) return;

    setLoading(prev => ({ ...prev, quartos: true }));
    try {
      await deleteDoc(doc(getQuartosCollection(), quartoId));
      toast({ title: "Quarto excluído com sucesso!" });
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
    const leitosDoSetor = leitos.filter(leito => leito.setorId === setorId);
    const leitosEmQuartos = quartos.flatMap(quarto => quarto.leitosIds || []);
    return leitosDoSetor.filter(leito => !leitosEmQuartos.includes(leito.id));
  };

  // Verificar se PCP deve estar habilitado
  const isPCPEnabled = () => {
    const codigos = leitoForm.codigosLeitos.split(',').map(code => code.trim()).filter(code => code);
    return codigos.length === 1;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="setores">Setores</TabsTrigger>
              <TabsTrigger value="leitos">Leitos</TabsTrigger>
              <TabsTrigger value="quartos">Quartos</TabsTrigger>
            </TabsList>

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
              <Card>
                <CardHeader>
                  <CardTitle>Novo(s) Leito(s)</CardTitle>
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
                    <Button type="submit" disabled={loading.leitos}>
                      {loading.leitos && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Leito(s)
                    </Button>
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
                    <div className="space-y-6">
                      {/* Group beds by sector */}
                      {setores.map((setor) => {
                        const leitosDoSetor = leitos
                          .filter(l => l.setorId === setor.id)
                          .sort((a, b) => a.codigoLeito.localeCompare(b.codigoLeito));
                        
                        if (leitosDoSetor.length === 0) return null;
                        
                        return (
                          <div key={setor.id} className="border rounded-lg p-4">
                            <h4 className="font-semibold mb-3 text-primary">
                              {setor.nomeSetor} ({setor.siglaSetor})
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left p-2">Código</th>
                                    <th className="text-left p-2">Status</th>
                                    <th className="text-left p-2">PCP</th>
                                    <th className="text-left p-2">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {leitosDoSetor.map((leito) => (
                                    <tr key={leito.id} className="border-b">
                                      <td className="p-2">{leito.codigoLeito}</td>
                                      <td className="p-2">{leito.status}</td>
                                      <td className="p-2">{leito.isPCP ? 'Sim' : 'Não'}</td>
                                      <td className="p-2">
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => handleDeleteLeito(leito.id)}
                                          disabled={loading.leitos}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba Quartos */}
            <TabsContent value="quartos" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingQuarto ? 'Editar Quarto' : 'Novo Quarto'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleQuartoSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="nomeQuarto">Nome do Quarto</Label>
                        <Input
                          id="nomeQuarto"
                          value={quartoForm.nomeQuarto}
                          onChange={(e) => setQuartoForm({...quartoForm, nomeQuarto: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="setorQuarto">Setor</Label>
                        <Select 
                          value={quartoForm.setorId} 
                          onValueChange={(value) => setQuartoForm({...quartoForm, setorId: value, leitosIds: []})}
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
                    </div>

                    {quartoForm.setorId && (
                      <div>
                        <Label>Leitos Disponíveis</Label>
                        {/* Search field for beds */}
                        <div className="mb-3">
                          <Input
                            placeholder="Pesquisar leito..."
                            value={leitoSearch}
                            onChange={(e) => setLeitoSearch(e.target.value)}
                          />
                        </div>
                        <div className="border rounded-md p-4 max-h-40 overflow-y-auto">
                          {(() => {
                            const leitosDisponiveis = getLeitosDisponiveis(quartoForm.setorId)
                              .filter(leito => 
                                leito.codigoLeito.toLowerCase().includes(leitoSearch.toLowerCase())
                              );
                            
                            return leitosDisponiveis.length === 0 ? (
                              <p className="text-muted-foreground">
                                {leitoSearch ? 'Nenhum leito encontrado com este código' : 'Nenhum leito disponível neste setor'}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {leitosDisponiveis.map((leito) => (
                                  <div key={leito.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`leito-${leito.id}`}
                                      checked={quartoForm.leitosIds.includes(leito.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setQuartoForm({
                                            ...quartoForm,
                                            leitosIds: [...quartoForm.leitosIds, leito.id]
                                          });
                                        } else {
                                          setQuartoForm({
                                            ...quartoForm,
                                            leitosIds: quartoForm.leitosIds.filter(id => id !== leito.id)
                                          });
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`leito-${leito.id}`}>
                                      {leito.codigoLeito}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading.quartos}>
                        {loading.quartos && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Salvar Quarto
                      </Button>
                      {editingQuarto && (
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => {
                            setEditingQuarto(null);
                            setQuartoForm({ id: '', nomeQuarto: '', setorId: '', leitosIds: [] });
                            setLeitoSearch('');
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Lista de Quartos */}
              <Card>
                <CardHeader>
                  <CardTitle>Quartos Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                  {quartos.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum quarto cadastrado ainda.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {/* Group rooms by sector */}
                      {setores.map((setor) => {
                        const quartosDoSetor = quartos.filter(q => q.setorId === setor.id);
                        
                        if (quartosDoSetor.length === 0) return null;
                        
                        return (
                          <div key={setor.id} className="border rounded-lg p-4">
                            <h4 className="font-semibold mb-4 text-primary">
                              {setor.nomeSetor} ({setor.siglaSetor})
                            </h4>
                            <div className="space-y-4">
                              {quartosDoSetor.map((quarto) => {
                                const leitosDoQuarto = leitos.filter(l => quarto.leitosIds?.includes(l.id));
                                return (
                                  <div key={quarto.id} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <h5 className="font-semibold">{quarto.nomeQuarto}</h5>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEditQuarto(quarto)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => handleDeleteQuarto(quarto.id)}
                                          disabled={loading.quartos}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium mb-1">Leitos:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {leitosDoQuarto.map((leito) => (
                                          <span
                                            key={leito.id}
                                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                          >
                                            {leito.codigoLeito}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default GerenciamentoLeitosModal;