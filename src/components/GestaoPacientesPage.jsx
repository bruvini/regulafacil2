import React, { useEffect, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Search, 
  Eye, 
  Edit2, 
  Trash2, 
  Users,
  AlertTriangle
} from 'lucide-react';
import { 
  getPacientesCollection,
  getLeitosCollection,
  getSetoresCollection,
  onSnapshot,
  updateDoc,
  doc,
  db,
  writeBatch,
  getDocs,
  deleteField,
  arrayUnion,
  serverTimestamp
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { toast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Import modal components
import VisualizarPacienteModal from './modals/VisualizarPacienteModal';
import EditarPacienteModal from './modals/EditarPacienteModal';

// Helper function to calculate age
const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return 0;
  
  try {
    let birthDate;
    
    // Handle Firestore timestamp
    if (dataNascimento.toDate && typeof dataNascimento.toDate === 'function') {
      birthDate = dataNascimento.toDate();
    }
    // Handle Date object
    else if (dataNascimento instanceof Date) {
      birthDate = dataNascimento;
    }
    // Handle string dates
    else if (typeof dataNascimento === 'string') {
      if (dataNascimento.includes('/')) {
        const [day, month, year] = dataNascimento.split('/');
        birthDate = new Date(year, month - 1, day);
      } else {
        birthDate = parseISO(dataNascimento);
      }
    }
    else {
      return 0;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  } catch (error) {
    console.error('Erro ao calcular idade:', error);
    return 0;
  }
};

const GestaoPacientesPage = () => {
  const [pacientes, setPacientes] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [visualizarPaciente, setVisualizarPaciente] = useState(null);
  const [editarPaciente, setEditarPaciente] = useState(null);
  const [excluirPaciente, setExcluirPaciente] = useState(null);
  
  // Cleanup states
  const [limpezaStep, setLimpezaStep] = useState(0);
  const [confirmText, setConfirmText] = useState('');

  // Real-time data fetching
  useEffect(() => {
    console.log('GestaoPacientesPage: Iniciando busca de dados...');
    const unsubscribers = [];

    // Patients
    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log('GestaoPacientesPage: Pacientes carregados:', lista.length, lista);
      setPacientes(lista);
      setLoading(false);
    }, (error) => {
      console.error('Erro ao carregar pacientes:', error);
      setLoading(false);
    });

    // Beds
    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log('GestaoPacientesPage: Leitos carregados:', lista.length);
      setLeitos(lista);
    }, (error) => {
      console.error('Erro ao carregar leitos:', error);
    });

    // Sectors
    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log('GestaoPacientesPage: Setores carregados:', lista.length);
      setSetores(lista);
    }, (error) => {
      console.error('Erro ao carregar setores:', error);
    });

    unsubscribers.push(unsubscribePacientes, unsubscribeLeitos, unsubscribeSetores);

    return () => {
      console.log('GestaoPacientesPage: Limpando listeners...');
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // Enhanced patient list with location info
  const pacientesEnriquecidos = useMemo(() => {
    console.log('GestaoPacientesPage: Calculando pacientesEnriquecidos...', {
      pacientes: pacientes.length,
      leitos: leitos.length,
      setores: setores.length,
      searchTerm
    });
    
    if (!pacientes.length) {
      console.log('GestaoPacientesPage: Nenhum paciente encontrado');
      return [];
    }

    const resultado = pacientes
      .filter((paciente) =>
        paciente.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .map((paciente) => {
        const leito = leitos.find((l) => l.id === paciente.leitoId);
        const setor = leito ? setores.find((s) => s.id === leito.setorId) : null;

        return {
          ...paciente,
          codigoLeito: leito?.codigoLeito || 'N/A',
          siglaSetor: setor?.siglaSetor || 'N/A',
          nomeSetor: setor?.nomeSetor || 'N/A',
        };
      })
      .sort((a, b) => a.nomeCompleto?.localeCompare(b.nomeCompleto) || 0);
    
    console.log('GestaoPacientesPage: Pacientes enriquecidos:', resultado.length, resultado);
    return resultado;
  }, [pacientes, leitos, setores, searchTerm]);

  const handleEditarPaciente = async (pacienteId, dadosAtualizados) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), pacienteId);
      await updateDoc(pacienteRef, dadosAtualizados);

      const paciente = pacientes.find(p => p.id === pacienteId);
      await logAction('Gestão de Pacientes', `Dados do paciente '${paciente?.nomeCompleto}' foram atualizados.`);
      
      toast({
        title: "Sucesso",
        description: "Dados do paciente atualizados com sucesso.",
      });

      setEditarPaciente(null);
    } catch (error) {
      console.error('Erro ao atualizar paciente:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar dados do paciente.",
        variant: "destructive",
      });
    }
  };

  const handleExcluirPaciente = async (paciente) => {
    try {
      const batch = writeBatch(db);

      // Delete patient document
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      batch.delete(pacienteRef);

      // Update bed if patient is assigned to one
      if (paciente.leitoId) {
        const leitoRef = doc(getLeitosCollection(), paciente.leitoId);
        batch.update(leitoRef, { 
          historicoMovimentacao: arrayUnion({
            statusLeito: 'Vago',
            dataHora: serverTimestamp(),
            usuario: 'Sistema - Gestão de Pacientes'
          }),
          pacienteId: deleteField()
        });
      }

      await batch.commit();

      await logAction('Gestão de Pacientes', `Paciente '${paciente.nomeCompleto}' foi excluído do sistema.`);
      
      toast({
        title: "Sucesso",
        description: "Paciente excluído com sucesso.",
      });

      setExcluirPaciente(null);
    } catch (error) {
      console.error('Erro ao excluir paciente:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir paciente.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmarLimpezaGeral = async () => {
    console.log('GestaoPacientesPage: Iniciando limpeza geral...');
    try {
      const pacientesSnapshot = await getDocs(getPacientesCollection());
      console.log('GestaoPacientesPage: Documentos de pacientes encontrados:', pacientesSnapshot.docs.length);
      const batch = writeBatch(db);

      pacientesSnapshot.forEach((pacienteDoc) => {
        const pacienteData = pacienteDoc.data();
        console.log('GestaoPacientesPage: Processando paciente:', pacienteData.nomeCompleto);
        
        // Delete patient
        batch.delete(pacienteDoc.ref);

        // Update bed if patient is assigned
        if (pacienteData.leitoId) {
          console.log('GestaoPacientesPage: Desocupando leito:', pacienteData.leitoId);
          const leitoRef = doc(getLeitosCollection(), pacienteData.leitoId);
          batch.update(leitoRef, { 
            historicoMovimentacao: arrayUnion({
              statusLeito: 'Vago',
              dataHora: serverTimestamp(),
              usuario: 'Sistema - Limpeza Geral'
            }),
            pacienteId: deleteField()
          });
        }
      });

      // Garantir que todos os leitos fiquem vagos (mesmo se houver vínculos órfãos)
      const leitosSnapshot = await getDocs(getLeitosCollection());
      console.log('GestaoPacientesPage: Verificando leitos com vínculo de paciente:', leitosSnapshot.docs.length);
      leitosSnapshot.forEach((leitoDoc) => {
        const leitoData = leitoDoc.data();
        if (leitoData.pacienteId) {
          batch.update(leitoDoc.ref, {
            historicoMovimentacao: arrayUnion({
              statusLeito: 'Vago',
              dataHora: serverTimestamp(),
              usuario: 'Sistema - Limpeza Geral'
            }),
            pacienteId: deleteField()
          });
        }
      });

      console.log('GestaoPacientesPage: Executando batch commit...');
      await batch.commit();

      await logAction('Gestão de Pacientes', 'LIMPEZA GERAL EXECUTADA: Todos os pacientes foram removidos e leitos desocupados.');
      
      toast({
        title: "Limpeza Concluída",
        description: "Todos os pacientes foram removidos com sucesso.",
      });

      setLimpezaStep(0);
      setConfirmText('');
      console.log('GestaoPacientesPage: Limpeza geral concluída com sucesso');
    } catch (error) {
      console.error('Erro na limpeza geral:', error);
      toast({
        title: "Erro",
        description: "Erro ao executar limpeza geral.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      // Handle Firestore timestamp objects
      if (dateString.toDate && typeof dateString.toDate === 'function') {
        return format(dateString.toDate(), 'dd/MM/yyyy', { locale: ptBR });
      }
      // Handle string dates in dd/MM/yyyy format
      if (typeof dateString === 'string' && dateString.includes('/')) {
        const [day, month, year] = dateString.split('/');
        const date = new Date(year, month - 1, day);
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
      }
      // Handle ISO string dates
      if (typeof dateString === 'string') {
        const date = parseISO(dateString);
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
      }
      // Handle Date objects
      if (dateString instanceof Date) {
        return format(dateString, 'dd/MM/yyyy', { locale: ptBR });
      }
      return 'Data inválida';
    } catch {
      return 'Data inválida';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestão de Pacientes
          </CardTitle>
          <CardDescription>
            Gerencie os pacientes cadastrados no sistema
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Tools */}
      <div className="flex justify-between items-center gap-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Button
          variant="destructive"
          onClick={() => {
            console.log('GestaoPacientesPage: Botão limpeza geral clicado, pacientes:', pacientes.length);
            setLimpezaStep(1);
          }}
          disabled={pacientes.length === 0}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Limpeza Geral
        </Button>
      </div>

      {/* Patients Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Paciente</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Data de Internação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacientesEnriquecidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado.'}
                  </TableCell>
                </TableRow>
              ) : (
                pacientesEnriquecidos.map((paciente) => (
                  <TableRow key={paciente.id}>
                    <TableCell className="font-medium">
                      {paciente.nomeCompleto}
                    </TableCell>
                    <TableCell>
                      {paciente.siglaSetor} - {paciente.codigoLeito}
                    </TableCell>
                    <TableCell>{paciente.especialidade || 'N/A'}</TableCell>
                    <TableCell>{formatDate(paciente.dataInternacao)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setVisualizarPaciente(paciente)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditarPaciente(paciente)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExcluirPaciente(paciente)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      {visualizarPaciente && (
        <VisualizarPacienteModal
          isOpen={!!visualizarPaciente}
          onClose={() => setVisualizarPaciente(null)}
          paciente={visualizarPaciente}
        />
      )}

      {editarPaciente && (
        <EditarPacienteModal
          isOpen={!!editarPaciente}
          onClose={() => setEditarPaciente(null)}
          paciente={editarPaciente}
          onSave={handleEditarPaciente}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!excluirPaciente} onOpenChange={() => setExcluirPaciente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o paciente <strong>{excluirPaciente?.nomeCompleto}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleExcluirPaciente(excluirPaciente)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* General Cleanup - First Confirmation */}
      <AlertDialog open={limpezaStep === 1} onOpenChange={() => setLimpezaStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Limpeza Geral
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja iniciar o processo de limpeza geral? 
              <strong> TODOS os pacientes serão removidos.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLimpezaStep(0)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setLimpezaStep(2)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* General Cleanup - Final Confirmation */}
      <AlertDialog open={limpezaStep === 2} onOpenChange={() => setLimpezaStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmação Final
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível e apagará todos os dados de pacientes. 
              Para confirmar, digite <strong>"CONFIRMAR"</strong> no campo abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Input
              placeholder="Digite CONFIRMAR"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setLimpezaStep(0);
              setConfirmText('');
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarLimpezaGeral}
              disabled={confirmText !== 'CONFIRMAR'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Executar Limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GestaoPacientesPage;