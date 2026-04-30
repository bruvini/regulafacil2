import { describe, it, expect, vi } from 'vitest';
import { CompatibilidadeLeitoService } from '../CompatibilidadeLeitoService';
import { FhirPatient, FhirLocation } from '../types';

describe('CompatibilidadeLeitoService', () => {
  it('deve validar especialidade compativel com o setor', () => {
    const patient: FhirPatient = {
      id: '1',
      name: 'Teste',
      gender: 'M',
      extension: [{ url: 'especialidade', valueString: 'NEUROCIRURGIA' }]
    };

    const location: FhirLocation = {
      id: 'l1',
      name: 'Leito 1',
      status: 'active'
    };

    const isCompativel = CompatibilidadeLeitoService.verificarEspecialidade(patient, location, 'UNID. JS ORTOPEDIA');
    expect(isCompativel).toBe(true);
  });

  it('deve rejeitar especialidade incompatível', () => {
    const patient: FhirPatient = {
      id: '2',
      name: 'Teste',
      gender: 'F',
      extension: [{ url: 'especialidade', valueString: 'CARDIOLOGIA' }]
    };

    const location: FhirLocation = {
      id: 'l2',
      name: 'Leito 2',
      status: 'active'
    };

    const isCompativel = CompatibilidadeLeitoService.verificarEspecialidade(patient, location, 'UNID. JS ORTOPEDIA');
    expect(isCompativel).toBe(false);
  });

  it('deve integrar com fn legado e retornar true se ambos passarem', () => {
    const patient: FhirPatient = {
      id: '1',
      name: 'Teste',
      gender: 'M',
      extension: [{ url: 'especialidade', valueString: 'CLINICA GERAL' }]
    };
    const location: FhirLocation = { id: 'l1', name: 'Leito 1', status: 'available', type: 'enfermaria' };

    const mockLegacyFn = vi.fn().mockReturnValue([{ id: 'l1' }]);

    const result = CompatibilidadeLeitoService.isLeitoCompativel(
      patient, location, 'UNID. CLINICA MEDICA', mockLegacyFn, {}, {}
    );

    expect(result).toBe(true);
    expect(mockLegacyFn).toHaveBeenCalled();
  });

  it('leito com status livre deve ser reconhecido como disponível', () => {
    expect(CompatibilidadeLeitoService.normalizeStatus('livre')).toBe('available');
    expect(CompatibilidadeLeitoService.normalizeStatus('Vago')).toBe('available');
  });

  it('leito com ENF deve ser reconhecido como enfermaria', () => {
    expect(CompatibilidadeLeitoService.normalizeTipoLeito('ENF')).toBe('enfermaria');
    expect(CompatibilidadeLeitoService.normalizeTipoLeito('enfermaria')).toBe('enfermaria');
  });

  it('leito com status ocupado não é filtrado incorretamente como disponível', () => {
    expect(CompatibilidadeLeitoService.normalizeStatus('ocupado')).toBe('occupied');
  });

  it('deve aceitar paciente sem especialidade no modo legado ou se o leito permitir', () => {
    const patient: FhirPatient = {
      id: 'p-no-spec', name: 'No Spec', gender: 'M'
    };
    const location: FhirLocation = { id: 'l1', name: 'L1', status: 'available', type: 'enfermaria' };
    
    // Legacy mode should definitely allow it
    expect(CompatibilidadeLeitoService.isLeitoCompativel(
      patient, location, 'UNID. CLINICA MEDICA', () => [{ id: 'l1' }], {}, {}, true
    )).toBe(true);
  });

  it('deve aceitar qualquer paciente se o leito não tiver especialidade restrita', () => {
    const patient: FhirPatient = {
      id: 'p1', name: 'P1', gender: 'M', extension: [{ url: 'especialidade', valueString: 'PSIQUIATRIA' }]
    };
    const location: FhirLocation = { id: 'l1', name: 'L1', status: 'available', type: 'enfermaria' };
    
    // Bed with no specialties defined in the map should accept
    expect(CompatibilidadeLeitoService.isLeitoCompativel(
      patient, location, 'SETOR DESCONHECIDO', () => [{ id: 'l1' }], {}, {}, false
    )).toBe(true);
  });
});
