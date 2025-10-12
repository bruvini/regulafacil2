import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const initialFormState = {
  psDecisaoClinica: 0,
  psDecisaoCirurgica: 0,
  psDecisaoCirurgicaNeuro: 0,
  salaLaranja: 0,
  salaEmergencia: 0,
  salaEmergenciaVm: 0,
  unidAvcAgudo: 0,
  unidAvcAgudoVm: 0,
  centroCirurgicoSalasAtivas: 0,
  centroCirurgicoSalasBloqueadas: 0,
  centroCirurgicoMotivoBloqueio: ''
};

const BoletimDiarioInputModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...initialFormState });
    }
  }, [isOpen]);

  const handleNumberChange = (field) => (event) => {
    const { value } = event.target;
    setFormData(prev => ({
      ...prev,
      [field]: value === '' ? '' : Number(value)
    }));
  };

  const handleTextChange = (event) => {
    const { value } = event.target;
    setFormData(prev => ({
      ...prev,
      centroCirurgicoMotivoBloqueio: value
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      psDecisaoClinica: Number(formData.psDecisaoClinica) || 0,
      psDecisaoCirurgica: Number(formData.psDecisaoCirurgica) || 0,
      psDecisaoCirurgicaNeuro: Number(formData.psDecisaoCirurgicaNeuro) || 0,
      salaLaranja: Number(formData.salaLaranja) || 0,
      salaEmergencia: Number(formData.salaEmergencia) || 0,
      salaEmergenciaVm: Number(formData.salaEmergenciaVm) || 0,
      unidAvcAgudo: Number(formData.unidAvcAgudo) || 0,
      unidAvcAgudoVm: Number(formData.unidAvcAgudoVm) || 0,
      centroCirurgicoSalasAtivas: Number(formData.centroCirurgicoSalasAtivas) || 0,
      centroCirurgicoSalasBloqueadas: Number(formData.centroCirurgicoSalasBloqueadas) || 0,
      centroCirurgicoMotivoBloqueio: formData.centroCirurgicoMotivoBloqueio?.trim() || ''
    };

    setFormData(payload);
    onSubmit?.(payload);
  };

  const mostrarMotivoBloqueio = Number(formData.centroCirurgicoSalasBloqueadas) > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Boletim diário - Dados manuais</DialogTitle>
            <DialogDescription>
              Informe as contagens coletadas manualmente para consolidar o boletim diário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Setores de Emergência
              </h4>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="psDecisaoClinica">
                    Pacientes observados em "PS DECISÃO CLINICA"
                  </label>
                  <Input
                    id="psDecisaoClinica"
                    type="number"
                    min="0"
                    value={formData.psDecisaoClinica}
                    onChange={handleNumberChange('psDecisaoClinica')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="psDecisaoCirurgica">
                    Pacientes observados em "PS DECISÃO CIRURGICA"
                  </label>
                  <Input
                    id="psDecisaoCirurgica"
                    type="number"
                    min="0"
                    value={formData.psDecisaoCirurgica}
                    onChange={handleNumberChange('psDecisaoCirurgica')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="psDecisaoCirurgicaNeuro">
                    Pacientes observados pela Neuroclínica em "PS DECISÃO CIRURGICA"
                  </label>
                  <Input
                    id="psDecisaoCirurgicaNeuro"
                    type="number"
                    min="0"
                    value={formData.psDecisaoCirurgicaNeuro}
                    onChange={handleNumberChange('psDecisaoCirurgicaNeuro')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="salaLaranja">
                    Pacientes observados em "SALA LARANJA"
                  </label>
                  <Input
                    id="salaLaranja"
                    type="number"
                    min="0"
                    value={formData.salaLaranja}
                    onChange={handleNumberChange('salaLaranja')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="salaEmergencia">
                    Pacientes observados em "SALA DE EMERGENCIA"
                  </label>
                  <Input
                    id="salaEmergencia"
                    type="number"
                    min="0"
                    value={formData.salaEmergencia}
                    onChange={handleNumberChange('salaEmergencia')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="salaEmergenciaVm">
                    Pacientes em VM na "SALA DE EMERGENCIA"
                  </label>
                  <Input
                    id="salaEmergenciaVm"
                    type="number"
                    min="0"
                    value={formData.salaEmergenciaVm}
                    onChange={handleNumberChange('salaEmergenciaVm')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="unidAvcAgudo">
                    Pacientes observados em "UNID. AVC AGUDO"
                  </label>
                  <Input
                    id="unidAvcAgudo"
                    type="number"
                    min="0"
                    value={formData.unidAvcAgudo}
                    onChange={handleNumberChange('unidAvcAgudo')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="unidAvcAgudoVm">
                    Pacientes em VM na "UNID. AVC AGUDO"
                  </label>
                  <Input
                    id="unidAvcAgudoVm"
                    type="number"
                    min="0"
                    value={formData.unidAvcAgudoVm}
                    onChange={handleNumberChange('unidAvcAgudoVm')}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Centro Cirúrgico
              </h4>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="centroCirurgicoSalasAtivas">
                    Número de salas ativas
                  </label>
                  <Input
                    id="centroCirurgicoSalasAtivas"
                    type="number"
                    min="0"
                    value={formData.centroCirurgicoSalasAtivas}
                    onChange={handleNumberChange('centroCirurgicoSalasAtivas')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="centroCirurgicoSalasBloqueadas">
                    Número de salas bloqueadas
                  </label>
                  <Input
                    id="centroCirurgicoSalasBloqueadas"
                    type="number"
                    min="0"
                    value={formData.centroCirurgicoSalasBloqueadas}
                    onChange={handleNumberChange('centroCirurgicoSalasBloqueadas')}
                  />
                </div>
              </div>

              {mostrarMotivoBloqueio && (
                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium" htmlFor="centroCirurgicoMotivoBloqueio">
                    Motivo do bloqueio
                  </label>
                  <Textarea
                    id="centroCirurgicoMotivoBloqueio"
                    value={formData.centroCirurgicoMotivoBloqueio}
                    onChange={handleTextChange}
                    placeholder="Descreva o motivo do bloqueio"
                    className="min-h-[100px]"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose?.()}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary text-white hover:bg-primary/90">
              Consolidar boletim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BoletimDiarioInputModal;
