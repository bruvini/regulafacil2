import { describe, it, expect } from 'vitest';
import { RegulacaoService } from '../RegulacaoService';
import { validateHospitalData } from '../types';

describe('RegulacaoService Data Validation', () => {
  it('validateHospitalData deve retornar array se a entrada for um array', () => {
    const data = { estrutura: [{ id: 1, nomeSetor: 'A' }, { id: 2, nomeSetor: 'B' }] };
    const result = validateHospitalData(data);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  it('validateHospitalData deve converter para array se a entrada for um objeto', () => {
    const data = { 
      estrutura: { 
        'setor-1': { id: 1, nomeSetor: 'A' }, 
        'setor-2': { id: 2, nomeSetor: 'B' } 
      } 
    };
    const result = validateHospitalData(data);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  it('validateHospitalData não deve quebrar se estrutura for undefined', () => {
    const data = { estrutura: undefined };
    const result = validateHospitalData(data);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('processarSugestoes não deve quebrar com hospitalData contendo estrutura objeto', () => {
    const hospitalData = { 
      estrutura: { 
        '1': { id: '1', nomeSetor: 'UNID. CLINICA MEDICA', tipoSetor: 'ENFERMARIA', leitosVagos: [{ id: 'l1', codigoLeito: 'L1', status: 'Livre' }] } 
      } 
    };

    const pacientesEnriquecidos = [
      { id: 'p1', nomePaciente: 'José', setorId: 's-ps', especialidade: 'CLINICA GERAL', regulacaoAtiva: false }
    ];
    
    // Simulate pool
    const setoresDisponiveis = [{ id: '1', nomeSetor: 'UNID. CLINICA MEDICA', tipoSetor: 'ENFERMARIA', leitosVagos: [{ id: 'l1', codigoLeito: 'L1', status: 'Livre' }] }];
    
    // Test that the method runs without throwing 'map is not a function'
    const result = RegulacaoService.processarSugestoes(
      setoresDisponiveis,
      pacientesEnriquecidos,
      new Map(),
      hospitalData
    );

    // If it reached here without throwing, test passed
    expect(result).toBeDefined();
  });
});
