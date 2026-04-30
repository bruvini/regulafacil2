import { FhirPatient, FhirLocation, FhirEncounter, FhirFlag } from './types';
import { CompatibilidadeLeitoService } from '../domain/regulacao/CompatibilidadeLeitoService';

export class FhirMapper {
  static toPatient(paciente: any): FhirPatient {
    return {
      id: paciente?.id || 'unknown',
      name: paciente?.nomePaciente || paciente?.nome || 'Nome não informado',
      birthDate: paciente?.dataNascimento || null,
      gender: paciente?.sexo || 'unknown',
      extension: [
        { url: 'especialidade', valueString: paciente?.especialidade },
        { url: 'origem', valueString: paciente?.setorNome || paciente?.localizacaoAtual || paciente?.setorOrigem || paciente?.setorOrigemNome }
      ]
    };
  }

  static toPatients(pacientes: any[]): FhirPatient[] {
    if (!Array.isArray(pacientes)) return [];
    return pacientes.map(p => this.toPatient(p));
  }

  static toEncounter(paciente: any): FhirEncounter {
    return {
      id: `enc-${paciente?.id || 'unknown'}`,
      subject: { reference: `Patient/${paciente?.id || 'unknown'}` },
      period: { start: paciente?.dataInternacao || new Date() },
      location: [
        { location: { reference: `Location/${paciente?.leitoId || paciente?.leitoOrigemId || 'unknown'}` } }
      ],
      status: 'in-progress',
      class: 'IMP'
    };
  }

  static toEncounters(pacientes: any[]): FhirEncounter[] {
    if (!Array.isArray(pacientes)) return [];
    return pacientes.map(p => this.toEncounter(p));
  }

  static toLocation(leito: any, setor?: any): FhirLocation {
    const statusNorm = CompatibilidadeLeitoService.normalizeStatus(leito?.status);
    const tipoNorm = CompatibilidadeLeitoService.normalizeTipoLeito(setor?.tipoSetor || leito?.tipoLeito);
    return {
      id: leito?.id || 'unknown',
      name: leito?.codigoLeito || leito?.codigo || leito?.id || 'unknown',
      status: statusNorm,
      type: tipoNorm,
      identifier: leito?.codigoLeito || leito?.codigo,
      partOf: setor?.id || leito?.setorId
    };
  }

  static toLocations(leitos: any[], setor?: any): FhirLocation[] {
    if (!Array.isArray(leitos)) return [];
    return leitos.map(l => this.toLocation(l, setor));
  }

  static toFlags(paciente: any, infeccoesMap: Map<string, any>): FhirFlag[] {
    if (!paciente || !Array.isArray(paciente.isolamentos)) return [];
    
    return paciente.isolamentos
      .filter((iso: any) => iso && iso.statusConsideradoAtivo)
      .map((iso: any, index: number) => {
        const infeccaoId = iso?.infeccaoId?.id ?? iso?.infeccaoId ?? iso?.idInfeccao ?? iso?.id ?? null;
        const dadosInfeccao = infeccaoId ? infeccoesMap.get(infeccaoId) : null;
        const rotulo =
          iso?.siglaInfeccao ||
          iso?.sigla ||
          dadosInfeccao?.siglaInfeccao ||
          dadosInfeccao?.sigla ||
          dadosInfeccao?.nome ||
          iso?.nome ||
          iso?.descricao;

        return {
          id: `flag-${paciente.id}-${index}`,
          subject: { reference: `Patient/${paciente.id}` },
          code: { text: String(rotulo).toUpperCase() },
          status: 'active'
        };
      });
  }
}
