import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { BedDouble, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  updateDoc,
  doc,
  db,
  writeBatch,
  arrayUnion
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';

const SelecionarLeitoModal = ({ isOpen, onClose, reserva, leitos }) => {
  const { toast } = useToast();

  // Filtrar leitos disponíveis
  const leitosDisponiveis = useMemo(() => {
    return leitos.filter(leito =>
      (leito.status === 'Vago' || leito.status === 'Higienização') &&
      (leito.tipoSetor === 'Enfermaria' || leito.tipoSetor === 'UTI') &&
      !leito.reservaExterna &&
      !leito.regulacaoReserva &&
      !leito.regulacaoEmAndamento
    );
  }, [leitos]);

  const handleSelecionarLeito = async (leito) => {
    try {
      const batch = writeBatch(db);

      // Atualizar reserva com leito selecionado
      const reservaRef = doc(db, 'artifacts/regulafacil/public/data/reservasExternas', reserva.id);
      batch.update(reservaRef, {
        leitoReservadoId: leito.id,
        status: 'Reservado'
      });

      // Atualizar leito com informações da reserva
      const leitoRef = doc(db, 'artifacts/regulafacil/public/data/leitos', leito.id);
      batch.update(leitoRef, {
        reservaExterna: {
          reservaId: reserva.id,
          pacienteNome: reserva.nomeCompleto,
          pacienteSexo: reserva.sexo,
          pacienteDataNascimento: reserva.dataNascimento,
          origem: reserva.origem,
          detalheOrigem: reserva.origem === 'SISREG'
            ? `${reserva.instituicaoOrigem}, ${reserva.cidadeOrigem}`
            : reserva.especialidadeOncologia,
          idSolicitacao: reserva.idSolicitacao || null,
          instituicaoOrigem: reserva.instituicaoOrigem || null,
          cidadeOrigem: reserva.cidadeOrigem || null,
          especialidadeOncologia: reserva.especialidadeOncologia || null,
          telefoneContato: reserva.telefoneContato || null,
          isolamento: reserva.isolamento || 'NÃO'
        },
        status: 'Reservado',
        historico: arrayUnion({
          status: 'Reservado',
          timestamp: new Date(),
          origem: 'Reserva Externa'
        })
      });

      await batch.commit();

      await logAction(
        'Reservas de Leitos',
        `Leito ${leito.codigoLeito} reservado para: ${reserva.nomeCompleto}`
      );

      toast({
        title: "Sucesso",
        description: `Leito ${leito.codigoLeito} reservado com sucesso!`
      });

      onClose();
    } catch (error) {
      console.error('Erro ao reservar leito:', error);
      toast({
        title: "Erro",
        description: "Erro ao reservar leito. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  if (!reserva) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" />
            Selecionar Leito para {reserva.nomeCompleto}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do paciente */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="font-semibold">Paciente:</span> {reserva.nomeCompleto}
                </div>
                <div>
                  <span className="font-semibold">Sexo:</span> {reserva.sexo}
                </div>
                {reserva.isolamento !== 'NÃO' && (
                  <div>
                    <span className="font-semibold">Isolamento:</span> 
                    <Badge variant="destructive" className="ml-2">
                      {reserva.isolamento}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de leitos disponíveis */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">
              Leitos Disponíveis ({leitosDisponiveis.length})
            </h3>
            
            {leitosDisponiveis.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">
                    Nenhum leito disponível no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {leitosDisponiveis.map(leito => (
                  <LeitoCard 
                    key={leito.id}
                    leito={leito}
                    onSelecionar={handleSelecionarLeito}
                    reserva={reserva}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LeitoCard = ({ leito, onSelecionar, reserva }) => {
  // Verificar compatibilidade
  const isCompativel = () => {
    // Verificar contexto do quarto (coorte)
    if (leito.contextoQuarto) {
      // Se há um contexto de quarto, verificar sexo
      if (leito.contextoQuarto.sexo !== reserva.sexo) {
        return false;
      }
      // TODO: Verificar isolamentos também se necessário
    }
    return true;
  };

  const compativel = isCompativel();

  return (
    <Card className={`transition-colors ${compativel ? 'hover:bg-accent cursor-pointer' : 'opacity-50'}`}>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4" />
              <span className="font-semibold text-lg">{leito.codigoLeito}</span>
              <Badge variant="outline">{leito.status}</Badge>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{leito.nomeSetor}</span>
              {leito.nomeQuarto && <span>• {leito.nomeQuarto}</span>}
            </div>

            {/* Mostrar contexto do quarto se houver */}
            {leito.contextoQuarto && (
              <div className="text-sm">
                <Badge variant={compativel ? "secondary" : "destructive"}>
                  Coorte: Apenas {leito.contextoQuarto.sexo}
                  {leito.contextoQuarto.isolamentos && leito.contextoQuarto.isolamentos.length > 0 && 
                    ` com ${leito.contextoQuarto.isolamentos.map(i => i.sigla).join(', ')}`
                  }
                </Badge>
              </div>
            )}

            {!compativel && (
              <p className="text-sm text-destructive">
                Este leito não é compatível com o paciente
              </p>
            )}
          </div>

          <Button 
            onClick={() => onSelecionar(leito)}
            disabled={!compativel}
            size="sm"
          >
            Selecionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SelecionarLeitoModal;