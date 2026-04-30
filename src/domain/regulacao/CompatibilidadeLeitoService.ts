import { FhirPatient, FhirLocation, FhirFlag } from './types';
import { ScoreRegulacaoService } from './ScoreRegulacaoService';

const PERFIS_DE_SETOR_POR_ESPECIALIDADE: Record<string, string[]> = {
  "UNID. JS ORTOPEDIA": ["NEUROCIRURGIA", "ODONTOLOGIA C.TRAUM.B.M.F.", "ORTOPEDIA/TRAUMATOLOGIA", "BUCOMAXILO"],
  "UNID. INT. GERAL - UIG": ["CLINICA GERAL", "INTENSIVISTA", "NEUROLOGIA", "PROCTOLOGIA", "UROLOGIA", "MASTOLOGIA"],
  "UNID. CLINICA MEDICA": ["CLINICA GERAL", "INTENSIVISTA", "NEUROLOGIA", "PROCTOLOGIA", "UROLOGIA", "MASTOLOGIA"],
  "UNID. ONCOLOGIA": ["HEMATOLOGIA", "ONCOLOGIA CIRURGICA", "ONCOLOGIA CLINICA/CANCEROLOGIA"],
  "UNID. CIRURGICA": ["CIRURGIA CABECA E PESCOCO", "CIRURGIA GERAL", "CIRURGIA TORACICA", "CIRURGIA VASCULAR", "NEUROCIRURGIA", "PROCTOLOGIA", "UROLOGIA", "ONCOLOGIA CIRURGICA", "MASTOLOGIA"],
  "UNID. NEFROLOGIA TRANSPLANTE": ["NEFROLOGIA", "HEPATOLOGISTA"],
};

export class CompatibilidadeLeitoService {
  static getPerfisNormalizados() {
    const map = new Map<string, Set<string>>();
    for (const [setor, especialidades] of Object.entries(PERFIS_DE_SETOR_POR_ESPECIALIDADE)) {
      map.set(
        ScoreRegulacaoService.normalizarTexto(setor), 
        new Set(especialidades.map(e => ScoreRegulacaoService.normalizarTexto(e)))
      );
    }
    return map;
  }

  static verificarEspecialidade(patient: FhirPatient, location: FhirLocation, setorNome: string): boolean {
    const especialidadePaciente = patient.extension?.find(e => e.url === 'especialidade')?.valueString;
    const especialidadeNorm = ScoreRegulacaoService.normalizarTexto(especialidadePaciente || '');
    
    const setorNorm = ScoreRegulacaoService.normalizarTexto(setorNome);
    const perfis = this.getPerfisNormalizados();
    const permitidas = perfis.get(setorNorm);
    
    if (!permitidas || permitidas.size === 0) return false;
    if (!especialidadeNorm || !permitidas.has(especialidadeNorm)) return false;

    return true;
  }

  static isLeitoCompativel(
    patient: FhirPatient, 
    location: FhirLocation, 
    setorNome: string,
    legacyCompatibilidadeFn: (paciente: any, data: any, modo: string) => any[],
    pacienteLegado: any,
    hospitalDataLegado: any
  ): boolean {
    if (!this.verificarEspecialidade(patient, location, setorNome)) {
      return false;
    }

    const leitosCompat = legacyCompatibilidadeFn(pacienteLegado, hospitalDataLegado, 'enfermaria');
    const leitosSet = new Set((leitosCompat || []).map((l: any) => String(l.id)));

    return leitosSet.has(String(location.id));
  }
}
