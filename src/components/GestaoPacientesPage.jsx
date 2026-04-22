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
  deleteDoc,
  writeBatch,
  getDocs,
  deleteField,
  arrayUnion,
  serverTimestamp
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Import modal components
import VisualizarPacienteModal from './modals/VisualizarPacienteModal';
import EditarPacienteModal from './modals/EditarPacienteModal';

const GestaoPacientesPage = () => {
  const [pacientes, setPacientes] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Modal states
  const [visualizarPaciente, setVisualizarPaciente] = useState(null);
  const [editarPaciente, setEditarPaciente] = useState(null);
  const [excluirPaciente, setExcluirPaciente] = useState(null);
  
  // Cleanup states
  const [limpezaStep, setLimpezaStep] = useState(0);
  const [confirmText, setConfirmText] = useState('');

  // Real-time data fetching
  useEffect(() => {
    const unsubscribers = [];

    // Patients
    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPacientes(lista);
      setLoading(false);
    });

    // Beds
    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLeitos(lista);
    });

    // Sectors
    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSetores(lista);
    });

    unsubscribers.push(unsubscribePacientes, unsubscribeLeitos, unsubscribeSetores);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // Enhanced patient list with location info
  const pacientesEnriquecidos = useMemo(() => {
    if (!pacientes.length) return [];

    const termoBusca = searchTerm.trim().toLowerCase();

    return pacientes
      .filter((paciente) => {
        if (!termoBusca) return true;

        const nomeNormalizado = (
          paciente.nomePaciente ||
          paciente.nomeCompleto ||
          ''
        ).toString().toLowerCase();
        const prontuario = (
          paciente.numeroProntuario ||
          paciente.numeroCarteirinha ||
          ''
        )
          .toString()
          .toLowerCase();

        return nomeNormalizado.includes(termoBusca) || prontuario.includes(termoBusca);
      })
      .map((paciente) => {
        const leito = leitos.find((l) => l.id === paciente.leitoId);
        const setor = leito ? setores.find((s) => s.id === leito.setorId) : null;
        const nomePaciente =
          paciente.nomePaciente || paciente.nomeCompleto || 'Paciente sem nome';

        return {
          ...paciente,
          nomePaciente,
          nomeCompleto: paciente.nomeCompleto ?? nomePaciente,
          codigoLeito: leito?.codigoLeito || leito?.codigo || 'N/A',
          siglaSetor:
            setor?.siglaSetor || setor?.nomeSetor || paciente.siglaSetor || 'N/A',
          nomeSetor: setor?.nomeSetor || setor?.siglaSetor || 'N/A',
        };
      })
      .sort((a, b) => {
        const nomeA = (a.nomePaciente || '').toString();
        const nomeB = (b.nomePaciente || '').toString();
        return nomeA.localeCompare(nomeB);
      });
  }, [pacientes, leitos, setores, searchTerm]);

  const handleEditarPaciente = async (pacienteId, dadosAtualizados) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), pacienteId);
      await updateDoc(pacienteRef, dadosAtualizados);

      const paciente = pacientes.find(p => p.id === pacienteId);
      await logAction(
        'Gestão de Pacientes',
        `Dados do paciente '${paciente?.nomePaciente || paciente?.nomeCompleto}' foram atualizados.`,
        currentUser
      );
      
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
          statusLeito: 'Vago',
          historicoMovimentacao: arrayUnion({
            statusLeito: 'Vago',
            dataHora: serverTimestamp(),
            usuario: 'Sistema - Gestão de Pacientes'
          }),
          pacienteId: deleteField(),
          reservaExterna: deleteField(),
          regulacaoEmAndamento: deleteField()
        });
      }

      await batch.commit();

      await logAction(
        'Gestão de Pacientes',
        `Paciente '${paciente.nomePaciente || paciente.nomeCompleto}' foi excluído do sistema.`,
        currentUser
      );
      
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
    try {
      // Get all patients and beds collections
      const [pacientesSnapshot, leitosSnapshot] = await Promise.all([
        getDocs(getPacientesCollection()),
        getDocs(getLeitosCollection())
      ]);
      
      const batch = writeBatch(db);
      let totalPacientesRemovidos = 0;
      let totalLeitosLiberados = 0;

      // Delete all patients
      pacientesSnapshot.forEach((pacienteDoc) => {
        batch.delete(pacienteDoc.ref);
        totalPacientesRemovidos++;
      });

      // Update all beds that are not 'Vago'
      leitosSnapshot.forEach((leitoDoc) => {
        const leitoData = leitoDoc.data();
        const statusAtual = leitoData.statusLeito;
        
        if (statusAtual && statusAtual !== 'Vago') {
          batch.update(leitoDoc.ref, {
            statusLeito: 'Vago',
            historicoMovimentacao: arrayUnion({
              statusLeito: 'Vago',
              dataHora: serverTimestamp(),
              usuario: 'Sistema - Limpeza Geral'
            }),
            // Remove any patient/reservation associations
            pacienteId: deleteField(),
            reservaExterna: deleteField(),
            regulacaoEmAndamento: deleteField()
          });
          totalLeitosLiberados++;
        }
      });

      await batch.commit();

      await logAction('Gestão de Pacientes',
        `LIMPEZA GERAL EXECUTADA: ${totalPacientesRemovidos} pacientes removidos e ${totalLeitosLiberados} leitos liberados.`,
        currentUser
      );
      
      toast({
        title: "Limpeza Concluída",
        description: `${totalPacientesRemovidos} pacientes removidos e ${totalLeitosLiberados} leitos liberados.`,
      });

      setLimpezaStep(0);
      setConfirmText('');
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
      if (dateString.toDate && typeof dateString.toDate === 'function') {
        return format(dateString.toDate(), 'dd/MM/yyyy', { locale: ptBR });
      }
      if (typeof dateString === 'string' && dateString.includes('/')) {
        const [day, month, year] = dateString.split('/');
        const date = new Date(year, month - 1, day);
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
      }
      if (typeof dateString === 'string') {
        const date = parseISO(dateString);
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
      }
      if (dateString instanceof Date) {
        return format(dateString, 'dd/MM/yyyy', { locale: ptBR });
      }
      return 'Data inválida';
    } catch {
      return 'Data inválida';
    }
  };

  const formatDateTime = (dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return format(dateValue.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
      if (typeof dateValue === 'string' && dateValue.includes('/')) {
        const [day, month, year] = dateValue.split('/');
        const date = new Date(year, month - 1, day);
        return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
      if (typeof dateValue === 'string') {
        const date = parseISO(dateValue);
        return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
      if (dateValue instanceof Date) {
        return format(dateValue, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
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
          onClick={() => setLimpezaStep(1)}
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
                <TableHead>Sexo</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Data de Nascimento</TableHead>
                <TableHead>Internação</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacientesEnriquecidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado.'}
                  </TableCell>
                </TableRow>
              ) : (
                pacientesEnriquecidos.map((paciente) => (
                  <TableRow key={paciente.id}>
                    <TableCell className="font-medium">
                      {paciente.nomePaciente}
                    </TableCell>
                    <TableCell>{paciente.sexo || 'N/A'}</TableCell>
                    <TableCell>{paciente.especialidade || 'N/A'}</TableCell>
                    <TableCell>{formatDate(paciente.dataNascimento)}</TableCell>
                    <TableCell>{formatDateTime(paciente.dataInternacao)}</TableCell>
                    <TableCell>
                      {paciente.siglaSetor} - {paciente.codigoLeito}
                    </TableCell>
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
              Tem certeza que deseja excluir o paciente{' '}
              <strong>{excluirPaciente?.nomePaciente || excluirPaciente?.nomeCompleto}</strong>?
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