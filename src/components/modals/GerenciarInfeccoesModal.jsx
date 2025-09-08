import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Edit, Plus } from 'lucide-react';
import { 
  getInfeccoesCollection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { toast } from '@/hooks/use-toast';

const GerenciarInfeccoesModal = ({ isOpen, onClose, infeccoes }) => {
  const [editandoInfeccao, setEditandoInfeccao] = useState(null);
  const [novaInfeccao, setNovaInfeccao] = useState({
    nomeInfeccao: '',
    siglaInfeccao: ''
  });
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setNovaInfeccao({
      nomeInfeccao: '',
      siglaInfeccao: ''
    });
    setEditandoInfeccao(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAdicionarInfeccao = async () => {
    if (!novaInfeccao.nomeInfeccao.trim() || !novaInfeccao.siglaInfeccao.trim()) {
      toast({
        title: "Erro",
        description: "Nome e sigla da infecção são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await addDoc(getInfeccoesCollection(), {
        nomeInfeccao: novaInfeccao.nomeInfeccao.trim(),
        siglaInfeccao: novaInfeccao.siglaInfeccao.trim().toUpperCase()
      });

      await logAction(
        "Gestão de Isolamentos",
        `Nova infecção cadastrada: ${novaInfeccao.nomeInfeccao} (${novaInfeccao.siglaInfeccao})`
      );

      toast({
        title: "Sucesso",
        description: "Infecção cadastrada com sucesso!"
      });

      resetForm();
    } catch (error) {
      console.error('Erro ao adicionar infecção:', error);
      toast({
        title: "Erro",
        description: "Erro ao cadastrar infecção. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditarInfeccao = async () => {
    if (!novaInfeccao.nomeInfeccao.trim() || !novaInfeccao.siglaInfeccao.trim()) {
      toast({
        title: "Erro",
        description: "Nome e sigla da infecção são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const infeccaoRef = doc(db, getInfeccoesCollection().path, editandoInfeccao.id);
      await updateDoc(infeccaoRef, {
        nomeInfeccao: novaInfeccao.nomeInfeccao.trim(),
        siglaInfeccao: novaInfeccao.siglaInfeccao.trim().toUpperCase()
      });

      await logAction(
        "Gestão de Isolamentos",
        `Infecção editada: ${novaInfeccao.nomeInfeccao} (${novaInfeccao.siglaInfeccao})`
      );

      toast({
        title: "Sucesso",
        description: "Infecção atualizada com sucesso!"
      });

      resetForm();
    } catch (error) {
      console.error('Erro ao editar infecção:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar infecção. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirInfeccao = async (infeccao) => {
    setLoading(true);
    try {
      const infeccaoRef = doc(db, getInfeccoesCollection().path, infeccao.id);
      await deleteDoc(infeccaoRef);

      await logAction(
        "Gestão de Isolamentos",
        `Infecção excluída: ${infeccao.nomeInfeccao} (${infeccao.siglaInfeccao})`
      );

      toast({
        title: "Sucesso",
        description: "Infecção excluída com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao excluir infecção:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir infecção. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicao = (infeccao) => {
    setEditandoInfeccao(infeccao);
    setNovaInfeccao({
      nomeInfeccao: infeccao.nomeInfeccao,
      siglaInfeccao: infeccao.siglaInfeccao
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Infecções</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Formulário para adicionar/editar */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nomeInfeccao">Nome da Infecção</Label>
                  <Input
                    id="nomeInfeccao"
                    placeholder="Ex: COVID-19"
                    value={novaInfeccao.nomeInfeccao}
                    onChange={(e) => setNovaInfeccao(prev => ({
                      ...prev,
                      nomeInfeccao: e.target.value
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siglaInfeccao">Sigla</Label>
                  <Input
                    id="siglaInfeccao"
                    placeholder="Ex: C19"
                    value={novaInfeccao.siglaInfeccao}
                    onChange={(e) => setNovaInfeccao(prev => ({
                      ...prev,
                      siglaInfeccao: e.target.value
                    }))}
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                {editandoInfeccao ? (
                  <>
                    <Button 
                      onClick={handleEditarInfeccao} 
                      disabled={loading}
                      className="flex-1"
                    >
                      Salvar Alterações
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={resetForm}
                      disabled={loading}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button 
                    onClick={handleAdicionarInfeccao} 
                    disabled={loading}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Infecção
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de infecções */}
          <div className="space-y-2">
            <Label>Infecções Cadastradas</Label>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {infeccoes.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Nenhuma infecção cadastrada
                </div>
              ) : (
                infeccoes.map((infeccao) => (
                  <Card key={infeccao.id} className="p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{infeccao.nomeInfeccao}</div>
                        <div className="text-sm text-muted-foreground">
                          Sigla: {infeccao.siglaInfeccao}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => iniciarEdicao(infeccao)}
                          disabled={loading}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={loading}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a infecção "{infeccao.nomeInfeccao}"? 
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleExcluirInfeccao(infeccao)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GerenciarInfeccoesModal;