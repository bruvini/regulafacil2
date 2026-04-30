import { describe, it, expect } from 'vitest';
import { ScoreRegulacaoService } from '../ScoreRegulacaoService';
import { FhirPatient, FhirEncounter, FhirFlag } from '../types';

describe('ScoreRegulacaoService', () => {
  it('deve calcular score de paciente idoso com isolamento', () => {
    const patient: FhirPatient = {
      id: '1',
      name: 'João',
      birthDate: new Date(new Date().getFullYear() - 85, 0, 1),
      gender: 'M',
      extension: []
    };
    const encounter: FhirEncounter = {
      id: 'enc-1',
      subject: { reference: 'Patient/1' },
      period: { start: new Date() },
      location: [],
      status: 'in-progress',
      class: 'IMP'
    };
    const flags: FhirFlag[] = [
      { id: 'f1', subject: { reference: 'Patient/1' }, code: { text: 'KPC' }, status: 'active' }
    ];

    const result = ScoreRegulacaoService.calcularScore(patient, encounter, flags);
    
    // Idoso > 80 = 20 pts
    // Isolamento = 30 pts
    // Espera = 0 pts
    // Origem = 0 pts
    expect(result.scoreTotal).toBe(50);
    expect(result.motivos).toContain('Possui isolamento compatível com o leito (+30)');
    expect(result.motivos).toContain('Paciente Superidoso >80a (+20)');
  });

  it('deve calcular score de paciente em RPA', () => {
    const patient: FhirPatient = {
      id: '2',
      name: 'Maria',
      birthDate: new Date(new Date().getFullYear() - 30, 0, 1),
      gender: 'F',
      extension: [{ url: 'origem', valueString: 'CC - RECUPERACAO' }]
    };
    const encounter: FhirEncounter = {
      id: 'enc-2',
      subject: { reference: 'Patient/2' },
      period: { start: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }, // 5 dias
      location: [],
      status: 'in-progress',
      class: 'IMP'
    };
    const flags: FhirFlag[] = [];

    const result = ScoreRegulacaoService.calcularScore(patient, encounter, flags);
    
    // Idoso = 0 pts
    // Isolamento = 0 pts
    // Origem RPA = 30 pts
    // Espera (5 dias * 2) = 10 pts
    expect(result.scoreTotal).toBe(40);
    expect(result.motivos).toContain('Retenção em RPA trava o CC (+30)');
    expect(result.motivos).toContain('Aguardando há 5 dias (+10)');
  });
});
