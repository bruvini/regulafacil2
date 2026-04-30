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

  static normalizeStatus(status: string | null | undefined): 'available' | 'occupied' | 'maintenance' {
    if (!status) return 'occupied';
    const s = ScoreRegulacaoService.normalizarTexto(status);
    if (s === 'LIVRE' || s === 'VAGO' || s === 'DISPONIVEL' || s === 'HIGIENIZACAO') return 'available';
    if (s === 'MANUTENCAO' || s === 'INTERDITADO') return 'maintenance';
    return 'occupied';
  }

  static normalizeTipoLeito(tipo: string | null | undefined): 'enfermaria' | 'uti' | 'isolamento' | 'outro' {
    if (!tipo) return 'enfermaria'; // Default legacy assumption
    const t = ScoreRegulacaoService.normalizarTexto(tipo);
    if (t === 'ENFERMARIA' || t === 'ENF') return 'enfermaria';
    if (t === 'UTI') return 'uti';
    if (t === 'ISOLAMENTO' || t === 'ISO') return 'isolamento';
    return 'enfermaria'; // Fallback to enfermaria if unknown
  }

  static verificarEspecialidade(patient: FhirPatient, location: FhirLocation, setorNome: string, legacyMode = false): boolean {
    if (legacyMode) return true;

    const especialidadePaciente = patient.extension?.find(e => e.url === 'especialidade')?.valueString;
    const especialidadeNorm = ScoreRegulacaoService.normalizarTexto(especialidadePaciente || '');
    
    const setorNorm = ScoreRegulacaoService.normalizarTexto(setorNome);
    const perfis = this.getPerfisNormalizados();
    const permitidas = perfis.get(setorNorm);
    
    if (!permitidas || permitidas.size === 0) return true; // Accept any patient if bed has no specific restrictions
    if (!especialidadeNorm) return true; // Accept patient if they have no specialty defined
    if (!permitidas.has(especialidadeNorm)) return false;

    return true;
  }

  static isLeitoCompativel(
    patient: FhirPatient, 
    location: FhirLocation, 
    setorNome: string,
    legacyCompatibilidadeFn: (paciente: any, data: any, modo: string) => any[],
    pacienteLegado: any,
    hospitalDataLegado: any,
    legacyMode = false
  ): boolean {
    if (!legacyMode && location.status !== 'available') {
      console.debug(`[CompatibilidadeLeitoService] leito ${location.id} descartado: motivo=STATUS_INVALIDO (${location.status})`);
      return false;
    }

    if (!legacyMode && location.type !== 'enfermaria') {
      console.debug(`[CompatibilidadeLeitoService] leito ${location.id} descartado: motivo=TIPO_INVALIDO (${location.type})`);
      return false;
    }

    if (!this.verificarEspecialidade(patient, location, setorNome, legacyMode)) {
      console.debug(`[CompatibilidadeLeitoService] leito ${location.id} descartado: motivo=ESPECIALIDADE_INCOMPATIVEL`);
      return false;
    }

    const leitosCompat = legacyCompatibilidadeFn(pacienteLegado, hospitalDataLegado, 'enfermaria');
    const leitosSet = new Set((leitosCompat || []).map((l: any) => String(l.id)));

    const legacyCompat = leitosSet.has(String(location.id));
    if (!legacyCompat && !legacyMode) {
      console.debug(`[CompatibilidadeLeitoService] leito ${location.id} descartado: motivo=REGRAS_COMPLEXAS_LEGADO`);
    }

    return legacyMode ? true : legacyCompat;
  }
}
