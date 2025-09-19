import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const EditarPacienteModal = ({ isOpen, onClose, paciente, onSave }) => {
  const [formData, setFormData] = useState({
    nomeCompleto: '',
    dataNascimento: '',
    sexo: '',
    especialidade: '',
    dataInternacao: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (paciente && isOpen) {
      // Format dates for input fields
      const formatDateForInput = (dateValue) => {
        if (!dateValue) return '';
        try {
          const date = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue.toDate();
          return format(date, 'yyyy-MM-dd');
        } catch {
          return '';
        }
      };

      setFormData({
        nomeCompleto: paciente.nomeCompleto || '',
        dataNascimento: formatDateForInput(paciente.dataNascimento),
        sexo: paciente.sexo || '',
        especialidade: paciente.especialidade || '',
        dataInternacao: formatDateForInput(paciente.dataInternacao),
      });
    }
  }, [paciente, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert date strings back to proper format
      const dadosAtualizados = {
        ...formData,
        dataNascimento: formData.dataNascimento ? new Date(formData.dataNascimento) : null,
        dataInternacao: formData.dataInternacao ? new Date(formData.dataInternacao) : null,
      };

      await onSave(paciente.id, dadosAtualizados);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            Editar Paciente
          </DialogTitle>
          <DialogDescription>
            Edite os dados do paciente {paciente?.nomeCompleto}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[60vh] w-full pr-4">
            <div className="space-y-4">
              {/* Nome Completo */}
              <div className="space-y-2">
                <Label htmlFor="nomeCompleto">Nome Completo</Label>
                <Input
                  id="nomeCompleto"
                  value={formData.nomeCompleto}
                  onChange={(e) => handleChange('nomeCompleto', e.target.value)}
                  required
                />
              </div>

              {/* Data de Nascimento */}
              <div className="space-y-2">
                <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                <Input
                  id="dataNascimento"
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(e) => handleChange('dataNascimento', e.target.value)}
                  required
                />
              </div>

              {/* Sexo */}
              <div className="space-y-2">
                <Label htmlFor="sexo">Sexo</Label>
                <Select
                  value={formData.sexo}
                  onValueChange={(value) => handleChange('sexo', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o sexo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Especialidade */}
              <div className="space-y-2">
                <Label htmlFor="especialidade">Especialidade</Label>
                <Select
                  value={formData.especialidade}
                  onValueChange={(value) => handleChange('especialidade', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLINICA GERAL">CLÍNICA GERAL</SelectItem>
                    <SelectItem value="CIRURGIA GERAL">CIRURGIA GERAL</SelectItem>
                    <SelectItem value="ORTOPEDIA/TRAUMATOLOGIA">ORTOPEDIA/TRAUMATOLOGIA</SelectItem>
                    <SelectItem value="NEUROLOGIA">NEUROLOGIA</SelectItem>
                    <SelectItem value="NEUROCIRURGIA">NEUROCIRURGIA</SelectItem>
                    <SelectItem value="CARDIOLOGIA">CARDIOLOGIA</SelectItem>
                    <SelectItem value="PNEUMOLOGIA">PNEUMOLOGIA</SelectItem>
                    <SelectItem value="GASTROENTEROLOGIA">GASTROENTEROLOGIA</SelectItem>
                    <SelectItem value="NEFROLOGIA">NEFROLOGIA</SelectItem>
                    <SelectItem value="ENDOCRINOLOGIA">ENDOCRINOLOGIA</SelectItem>
                    <SelectItem value="ONCOLOGIA CLINICA/CANCEROLOGIA">ONCOLOGIA CLÍNICA</SelectItem>
                    <SelectItem value="ONCOLOGIA CIRURGICA">ONCOLOGIA CIRÚRGICA</SelectItem>
                    <SelectItem value="HEMATOLOGIA">HEMATOLOGIA</SelectItem>
                    <SelectItem value="UROLOGIA">UROLOGIA</SelectItem>
                    <SelectItem value="PROCTOLOGIA">PROCTOLOGIA</SelectItem>
                    <SelectItem value="CIRURGIA VASCULAR">CIRURGIA VASCULAR</SelectItem>
                    <SelectItem value="CIRURGIA TORACICA">CIRURGIA TORÁCICA</SelectItem>
                    <SelectItem value="CIRURGIA CABECA E PESCOCO">CIRURGIA CABEÇA E PESCOÇO</SelectItem>
                    <SelectItem value="MASTOLOGIA">MASTOLOGIA</SelectItem>
                    <SelectItem value="BUCOMAXILO">BUCOMAXILO</SelectItem>
                    <SelectItem value="INTENSIVISTA">INTENSIVISTA</SelectItem>
                    <SelectItem value="HEPATOLOGISTA">HEPATOLOGISTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data de Internação */}
              <div className="space-y-2">
                <Label htmlFor="dataInternacao">Data de Internação</Label>
                <Input
                  id="dataInternacao"
                  type="date"
                  value={formData.dataInternacao}
                  onChange={(e) => handleChange('dataInternacao', e.target.value)}
                  required
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditarPacienteModal;