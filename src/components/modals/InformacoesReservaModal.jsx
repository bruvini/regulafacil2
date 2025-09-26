import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Calendar, User, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  updateDoc,
  doc,
  db,
  arrayUnion
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';

const InformacoesReservaModal = ({ isOpen, onClose, reserva }) => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [novaObservacao, setNovaObservacao] = useState('');
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);

  if (!reserva) return null;

  const statusStyles = {
    'Aguardando Leito': 'border-blue-200 bg-blue-50 text-blue-700',
    'Reservado': 'border-sky-200 bg-sky-50 text-sky-700',
    'Cancelada': 'border-destructive/30 bg-destructive/10 text-destructive',
    'Internado': 'border-emerald-200 bg-emerald-50 text-emerald-700'
  };
  const statusBadgeClass = statusStyles[reserva?.status] || 'border-muted bg-muted/10 text-muted-foreground';

  const handleAdicionarObservacao = async () => {
    if (!novaObservacao.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, digite uma observação.",
        variant: "destructive"
      });
      return;
    }

    setSalvandoObservacao(true);
    try {
      const observacao = {
        texto: novaObservacao.trim(),
        data: new Date(),
        usuarioNome: currentUser?.nomeCompleto || 'Usuário Desconhecido'
      };

      await updateDoc(
        doc(db, 'artifacts/regulafacil/public/data/reservasExternas', reserva.id), 
        {
          observacoes: arrayUnion(observacao)
        }
      );

      await logAction(
        'Reservas de Leitos',
        `Observação adicionada para reserva: ${reserva.nomeCompleto}`,
        currentUser
      );

      toast({
        title: "Sucesso",
        description: "Observação adicionada com sucesso!"
      });

      setNovaObservacao('');
    } catch (error) {
      console.error('Erro ao adicionar observação:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar observação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSalvandoObservacao(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Informações da Reserva
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dados do Paciente */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">Nome Completo</Label>
                  <p className="text-lg">{reserva.nomeCompleto}</p>
                </div>
                
                <div>
                  <Label className="font-semibold">Data de Nascimento</Label>
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {reserva.dataNascimento && format(reserva.dataNascimento.toDate(), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>

                <div>
                  <Label className="font-semibold">Sexo</Label>
                  <p>{reserva.sexo}</p>
                </div>

                <div>
                  <Label className="font-semibold">Isolamento</Label>
                  <div>
                    {reserva.isolamento === 'NÃO' ? (
                      <Badge variant="outline">Não</Badge>
                    ) : (
                      <Badge variant="destructive">{reserva.isolamento}</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="font-semibold">Origem</Label>
                  <Badge variant="secondary">{reserva.origem}</Badge>
                </div>

                <div>
                  <Label className="font-semibold">Status</Label>
                  <Badge variant="outline" className={statusBadgeClass}>
                    {reserva.status || 'Não informado'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados Específicos por Origem */}
          {reserva.origem === 'SISREG' ? (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Dados do SISREG
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold">ID da Solicitação</Label>
                    <p>{reserva.idSolicitacao}</p>
                  </div>
                  
                  <div>
                    <Label className="font-semibold">Data da Solicitação</Label>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {reserva.dataSolicitacao && format(reserva.dataSolicitacao.toDate(), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>

                  <div>
                    <Label className="font-semibold">Instituição de Origem</Label>
                    <p>{reserva.instituicaoOrigem}</p>
                  </div>

                  <div>
                    <Label className="font-semibold">Cidade de Origem</Label>
                    <p>{reserva.cidadeOrigem}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Dados da Oncologia
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold">Especialidade</Label>
                    <p>{reserva.especialidadeOncologia}</p>
                  </div>
                  
                  <div>
                    <Label className="font-semibold">Telefone de Contato</Label>
                    <p>{reserva.telefoneContato}</p>
                  </div>

                  <div>
                    <Label className="font-semibold">Data Prevista para Internação</Label>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {reserva.dataPrevistaInternacao && format(reserva.dataPrevistaInternacao.toDate(), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leito Reservado */}
          {reserva.leitoReservadoId && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4">Leito Reservado</h3>
                <Badge variant="outline" className="text-lg p-2">
                  ID: {reserva.leitoReservadoId}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Observações
              </h3>
              
              {/* Lista de observações existentes */}
              {reserva.observacoes && reserva.observacoes.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {reserva.observacoes.map((obs, index) => (
                    <div key={index} className="border-l-4 border-primary pl-4 py-2 bg-muted/50 rounded-r-md">
                      <p className="text-sm mb-1">{obs.texto}</p>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{obs.usuarioNome}</span>
                        •
                        <span>
                          {obs.data && format(obs.data.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground mb-4">Nenhuma observação registrada.</p>
              )}

              {/* Formulário para nova observação */}
              <div className="space-y-3">
                <Label htmlFor="novaObservacao">Nova Observação</Label>
                <Textarea
                  id="novaObservacao"
                  placeholder="Digite sua observação aqui..."
                  value={novaObservacao}
                  onChange={(e) => setNovaObservacao(e.target.value)}
                  rows={3}
                />
                <Button 
                  onClick={handleAdicionarObservacao}
                  disabled={salvandoObservacao}
                >
                  {salvandoObservacao ? 'Salvando...' : 'Adicionar Observação'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InformacoesReservaModal;