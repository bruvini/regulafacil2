import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RemanejamentoModal = ({ isOpen, onClose, onSave, paciente }) => {
  const [tipo, setTipo] = useState('');
  const [motivoPrioridade, setMotivoPrioridade] = useState('');
  const [justificativaMelhoria, setJustificativaMelhoria] = useState('');
  const [motivoContraFluxo, setMotivoContraFluxo] = useState('');
  const [altaSetor, setAltaSetor] = useState('');
  const [motivoNIR, setMotivoNIR] = useState('');

  const opcoesSolicitacao = [
    'Prioridade',
    'Adequação do perfil clínico com o setor',
    'Melhoria na assistência',
    'Contra Fluxo',
    'Liberado do isolamento',
    'Reserva interna de oncologia',
    'Alta do setor',
    'Necessidade do NIR'
  ];

  const opcoesAltaSetor = [
    'UTI',
    'AVCA', 
    'CEDUG',
    'Sala Laranja'
  ];

  const handleSave = () => {
    let detalhe = '';
    
    switch(tipo) {
      case 'Prioridade':
        detalhe = motivoPrioridade;
        break;
      case 'Melhoria na assistência':
        detalhe = justificativaMelhoria;
        break;
      case 'Contra Fluxo':
        detalhe = motivoContraFluxo;
        break;
      case 'Alta do setor':
        detalhe = altaSetor;
        break;
      case 'Necessidade do NIR':
        detalhe = motivoNIR;
        break;
      default:
        detalhe = '';
    }
    
    if (isFormValid()) {
      onSave({
        tipo: tipo,
        detalhe: detalhe.trim()
      });
      
      // Reset form
      setTipo('');
      setMotivoPrioridade('');
      setJustificativaMelhoria('');
      setMotivoContraFluxo('');
      setAltaSetor('');
      setMotivoNIR('');
    }
  };

  const handleClose = () => {
    setTipo('');
    setMotivoPrioridade('');
    setJustificativaMelhoria('');
    setMotivoContraFluxo('');
    setAltaSetor('');
    setMotivoNIR('');
    onClose();
  };

  const isFormValid = () => {
    if (!tipo) return false;
    
    switch(tipo) {
      case 'Prioridade':
        return motivoPrioridade.trim() !== '';
      case 'Melhoria na assistência':
        return justificativaMelhoria.trim() !== '';
      case 'Contra Fluxo':
        return motivoContraFluxo.trim() !== '';
      case 'Alta do setor':
        return altaSetor !== '';
      case 'Necessidade do NIR':
        return motivoNIR.trim() !== '';
      case 'Adequação do perfil clínico com o setor':
      case 'Liberado do isolamento':
      case 'Reserva interna de oncologia':
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar Remanejamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Paciente: <strong>{paciente?.nomePaciente}</strong>
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Motivo do Remanejamento</Label>
            <RadioGroup value={tipo} onValueChange={setTipo}>
              {opcoesSolicitacao.map((opcao) => (
                <div key={opcao} className="flex items-center space-x-2">
                  <RadioGroupItem value={opcao} id={opcao} />
                  <Label htmlFor={opcao} className="text-sm">
                    {opcao}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {tipo === 'Prioridade' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo da prioridade</Label>
              <Input
                placeholder="Digite o motivo da prioridade..."
                value={motivoPrioridade}
                onChange={(e) => setMotivoPrioridade(e.target.value)}
                maxLength={100}
              />
            </div>
          )}

          {tipo === 'Melhoria na assistência' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Justificativa</Label>
              <Textarea
                placeholder="Justifique a melhoria necessária..."
                value={justificativaMelhoria}
                onChange={(e) => setJustificativaMelhoria(e.target.value)}
                className="min-h-[80px]"
                maxLength={300}
              />
            </div>
          )}

          {tipo === 'Contra Fluxo' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo do contra fluxo</Label>
              <Input
                placeholder="Digite o motivo do contra fluxo..."
                value={motivoContraFluxo}
                onChange={(e) => setMotivoContraFluxo(e.target.value)}
                maxLength={100}
              />
            </div>
          )}

          {tipo === 'Alta do setor' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Setor de destino</Label>
              <Select value={altaSetor} onValueChange={setAltaSetor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesAltaSetor.map(setor => (
                    <SelectItem key={setor} value={setor}>
                      {setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === 'Necessidade do NIR' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo da necessidade</Label>
              <Textarea
                placeholder="Descreva a necessidade do NIR..."
                value={motivoNIR}
                onChange={(e) => setMotivoNIR(e.target.value)}
                className="min-h-[80px]"
                maxLength={300}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!isFormValid()}
          >
            Solicitar Remanejamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemanejamentoModal;