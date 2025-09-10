import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  UserPlus, 
  Eye, 
  Edit, 
  Trash2, 
  Users,
  UserCheck,
  UserCog,
  Activity
} from 'lucide-react';
import {
  getUsuariosCollection,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  getDocs,
  where,
  auth,
  createUserWithEmailAndPassword,
  deleteUser,
  db
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';

// Lista de páginas disponíveis para permissões
const PAGINAS_DISPONIVEIS = [
  { id: '/', label: 'Página Inicial' },
  { id: '/regulacao-leitos', label: 'Regulação de Leitos' },
  { id: '/mapa-leitos', label: 'Mapa de Leitos' },
  { id: '/central-higienizacao', label: 'Central de Higienização' },
  { id: '/gestao-isolamentos', label: 'Gestão de Isolamentos' },
  { id: '/marcacao-cirurgica', label: 'Marcação Cirúrgica' },
  { id: '/huddle', label: 'Huddle' },
  { id: '/gestao-estrategica', label: 'Gestão Estratégica' },
  { id: '/auditoria', label: 'Auditoria' },
  { id: '/gestao-usuarios', label: 'Gestão de Usuários' },
  { id: '/gestao-pacientes', label: 'Gestão de Pacientes' }
];

// Função para normalizar texto (maiúsculas e sem acentos)
const normalizarTexto = (texto) => {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

// Modal de Usuário (Criar/Editar/Visualizar)
const ModalUsuario = ({ isOpen, onClose, modo, usuario, onSave }) => {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    defaultValues: {
      nomeCompleto: '',
      matricula: '',
      emailInstitucional: '',
      tipoUsuario: 'Comum',
      permissoes: []
    }
  });

  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const tipoUsuarioSelecionado = watch('tipoUsuario');

  // Carregar dados do usuário quando for edição/visualização
  useEffect(() => {
    if (usuario && (modo === 'editar' || modo === 'visualizar')) {
      reset({
        nomeCompleto: usuario.nomeCompleto || '',
        matricula: usuario.matricula || '',
        emailInstitucional: usuario.emailInstitucional || '',
        tipoUsuario: usuario.tipoUsuario || 'Comum'
      });
      setPermissoesSelecionadas(usuario.permissoes || []);
    } else if (modo === 'criar') {
      reset({
        nomeCompleto: '',
        matricula: '',
        emailInstitucional: '',
        tipoUsuario: 'Comum',
        permissoes: []
      });
      setPermissoesSelecionadas([]);
    }
  }, [usuario, modo, reset]);

  const validarMatriculaUnica = async (matricula) => {
    if (modo === 'editar' && usuario?.matricula === matricula) return true;
    
    const q = query(getUsuariosCollection(), where('matricula', '==', matricula));
    const snapshot = await getDocs(q);
    return snapshot.empty;
  };

  const validarEmailUnico = async (email) => {
    if (modo === 'editar' && usuario?.emailInstitucional === email) return true;
    
    const q = query(getUsuariosCollection(), where('emailInstitucional', '==', email));
    const snapshot = await getDocs(q);
    return snapshot.empty;
  };

  const onSubmit = async (data) => {
    if (modo === 'visualizar') return;

    setLoading(true);
    try {
      // Validações
      if (!data.emailInstitucional.endsWith('@joinville.sc.gov.br')) {
        toast({
          variant: "destructive",
          title: "Erro de validação",
          description: "O e-mail deve terminar com @joinville.sc.gov.br"
        });
        setLoading(false);
        return;
      }

      // Verificar unicidade da matrícula
      const matriculaUnica = await validarMatriculaUnica(data.matricula);
      if (!matriculaUnica) {
        toast({
          variant: "destructive",
          title: "Erro de validação",
          description: "Esta matrícula já está cadastrada"
        });
        setLoading(false);
        return;
      }

      // Verificar unicidade do email
      const emailUnico = await validarEmailUnico(data.emailInstitucional);
      if (!emailUnico) {
        toast({
          variant: "destructive",
          title: "Erro de validação",
          description: "Este e-mail já está cadastrado"
        });
        setLoading(false);
        return;
      }

      // Preparar dados do usuário
      const dadosUsuario = {
        nomeCompleto: normalizarTexto(data.nomeCompleto),
        matricula: data.matricula,
        emailInstitucional: data.emailInstitucional.toLowerCase(),
        tipoUsuario: data.tipoUsuario,
        permissoes: data.tipoUsuario === 'Comum' ? permissoesSelecionadas : [],
        qtdAcessos: usuario?.qtdAcessos || 0,
        ultimoAcesso: usuario?.ultimoAcesso || null
      };

      if (modo === 'criar') {
        // Criar usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          data.emailInstitucional, 
          'HMSJ@2025'
        );
        
        // Adicionar UID aos dados e salvar no Firestore
        dadosUsuario.uid = userCredential.user.uid;
        await addDoc(getUsuariosCollection(), dadosUsuario);

        await logAction('Gestão de Usuários', `Usuário criado: ${dadosUsuario.nomeCompleto} (${dadosUsuario.emailInstitucional})`);
        
        toast({
          title: "Usuário criado",
          description: `${dadosUsuario.nomeCompleto} foi cadastrado com sucesso`
        });
      } else if (modo === 'editar') {
        // Atualizar no Firestore
        const docRef = doc(db, getUsuariosCollection()._path, usuario.id);
        await setDoc(docRef, dadosUsuario, { merge: true });

        await logAction('Gestão de Usuários', `Usuário editado: ${dadosUsuario.nomeCompleto} (${dadosUsuario.emailInstitucional})`);
        
        toast({
          title: "Usuário atualizado",
          description: `${dadosUsuario.nomeCompleto} foi atualizado com sucesso`
        });
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao salvar o usuário. Tente novamente."
      });
    }
    setLoading(false);
  };

  const handlePermissaoChange = (paginaId, checked) => {
    if (checked) {
      setPermissoesSelecionadas(prev => [...prev, paginaId]);
    } else {
      setPermissoesSelecionadas(prev => prev.filter(p => p !== paginaId));
    }
  };

  const getTituloModal = () => {
    switch (modo) {
      case 'criar': return 'Adicionar Novo Usuário';
      case 'editar': return 'Editar Usuário';
      case 'visualizar': return 'Visualizar Usuário';
      default: return 'Usuário';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTituloModal()}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomeCompleto">Nome Completo *</Label>
              <Input
                id="nomeCompleto"
                {...register('nomeCompleto', { required: 'Nome completo é obrigatório' })}
                disabled={modo === 'visualizar'}
                className={errors.nomeCompleto ? 'border-destructive' : ''}
              />
              {errors.nomeCompleto && (
                <span className="text-sm text-destructive">{errors.nomeCompleto.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="matricula">Número de Matrícula *</Label>
              <Input
                id="matricula"
                type="number"
                {...register('matricula', { required: 'Matrícula é obrigatória' })}
                disabled={modo === 'visualizar'}
                className={errors.matricula ? 'border-destructive' : ''}
              />
              {errors.matricula && (
                <span className="text-sm text-destructive">{errors.matricula.message}</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailInstitucional">E-mail Institucional *</Label>
            <Input
              id="emailInstitucional"
              type="email"
              {...register('emailInstitucional', { 
                required: 'E-mail é obrigatório',
                pattern: {
                  value: /^[^\s@]+@joinville\.sc\.gov\.br$/,
                  message: 'E-mail deve terminar com @joinville.sc.gov.br'
                }
              })}
              disabled={modo === 'visualizar'}
              className={errors.emailInstitucional ? 'border-destructive' : ''}
              placeholder="exemplo@joinville.sc.gov.br"
            />
            {errors.emailInstitucional && (
              <span className="text-sm text-destructive">{errors.emailInstitucional.message}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoUsuario">Tipo de Usuário *</Label>
            <Select
              value={watch('tipoUsuario')}
              onValueChange={(value) => setValue('tipoUsuario', value)}
              disabled={modo === 'visualizar'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Comum">Comum</SelectItem>
                <SelectItem value="Administrador">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoUsuarioSelecionado === 'Comum' && (
            <div className="space-y-4">
              <Label>Permissões de Acesso</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto border rounded-md p-4">
                {PAGINAS_DISPONIVEIS.map((pagina) => (
                  <div key={pagina.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`permissao-${pagina.id}`}
                      checked={permissoesSelecionadas.includes(pagina.id)}
                      onCheckedChange={(checked) => handlePermissaoChange(pagina.id, checked)}
                      disabled={modo === 'visualizar'}
                    />
                    <Label 
                      htmlFor={`permissao-${pagina.id}`} 
                      className="text-sm font-normal cursor-pointer"
                    >
                      {pagina.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modo !== 'visualizar' && (
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : modo === 'criar' ? 'Cadastrar' : 'Salvar'}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Componente principal da página
const GestaoUsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoModal, setModoModal] = useState('criar');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [loading, setLoading] = useState(true);

  // Buscar usuários em tempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(getUsuariosCollection(), (snapshot) => {
      const usuariosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsuarios(usuariosData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAbrirModal = (modo, usuario = null) => {
    setModoModal(modo);
    setUsuarioSelecionado(usuario);
    setModalAberto(true);
  };

  const handleFecharModal = () => {
    setModalAberto(false);
    setUsuarioSelecionado(null);
  };

  const handleSalvarUsuario = () => {
    // O modal já lida com a lógica de salvamento
    // Aqui apenas fechamos o modal
  };

  const handleExcluirUsuario = async (usuario) => {
    try {
      // Tentar excluir do Firebase Auth primeiro (se o UID existir)
      if (usuario.uid) {
        try {
          // Nota: Em produção, isso deve ser feito via Cloud Function
          // pois excluir usuários requer privilégios administrativos
          await deleteUser({ uid: usuario.uid });
        } catch (authError) {
          console.warn('Erro ao excluir do Auth (talvez já excluído):', authError);
        }
      }

      // Excluir do Firestore
      const docRef = doc(db, getUsuariosCollection()._path, usuario.id);
      await deleteDoc(docRef);

      await logAction('Gestão de Usuários', `Usuário excluído: ${usuario.nomeCompleto} (${usuario.emailInstitucional})`);

      toast({
        title: "Usuário excluído",
        description: `${usuario.nomeCompleto} foi removido do sistema`
      });
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir o usuário. Tente novamente."
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Gestão de Usuários</CardTitle>
                <p className="text-muted-foreground">
                  Administração completa de usuários do sistema
                </p>
              </div>
            </div>
            <Button onClick={() => handleAbrirModal('criar')}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Novo Usuário
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Tabela de usuários */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse text-primary" />
                <p className="text-muted-foreground">Carregando usuários...</p>
              </div>
            </div>
          ) : usuarios.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhum usuário cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece adicionando o primeiro usuário ao sistema
              </p>
              <Button onClick={() => handleAbrirModal('criar')}>
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Usuário
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Usuário</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Tipo de Usuário</TableHead>
                    <TableHead>Qtd. de Acessos</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((usuario) => (
                    <TableRow key={usuario.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold">{usuario.nomeCompleto}</p>
                          <p className="text-sm text-muted-foreground">
                            {usuario.emailInstitucional}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{usuario.matricula}</TableCell>
                      <TableCell>
                        <Badge variant={usuario.tipoUsuario === 'Administrador' ? 'default' : 'secondary'}>
                          {usuario.tipoUsuario === 'Administrador' ? (
                            <UserCog className="h-3 w-3 mr-1" />
                          ) : (
                            <UserCheck className="h-3 w-3 mr-1" />
                          )}
                          {usuario.tipoUsuario}
                        </Badge>
                      </TableCell>
                      <TableCell>{usuario.qtdAcessos || 'N/A'}</TableCell>
                      <TableCell>
                        {usuario.ultimoAcesso ? 
                          new Date(usuario.ultimoAcesso.seconds * 1000).toLocaleString() : 
                          'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAbrirModal('visualizar', usuario)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAbrirModal('editar', usuario)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza de que deseja excluir o usuário <strong>{usuario.nomeCompleto}</strong>?
                                  Esta ação não pode ser desfeita e o usuário perderá o acesso ao sistema.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleExcluirUsuario(usuario)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Usuário */}
      <ModalUsuario
        isOpen={modalAberto}
        onClose={handleFecharModal}
        modo={modoModal}
        usuario={usuarioSelecionado}
        onSave={handleSalvarUsuario}
      />
    </div>
  );
};

export default GestaoUsuariosPage;