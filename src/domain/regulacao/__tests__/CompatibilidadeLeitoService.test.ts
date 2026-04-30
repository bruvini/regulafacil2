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
});
