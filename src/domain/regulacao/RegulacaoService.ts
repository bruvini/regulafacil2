import { FhirMapper } from '../../adapters/fhirMapper';
import { ScoreRegulacaoService } from './ScoreRegulacaoService';
import { CompatibilidadeLeitoService } from './CompatibilidadeLeitoService';
import { encontrarLeitosCompativeis } from '../../lib/compatibilidadeUtils';
import { validateHospitalData } from './types';

const SETORES_POOL_REGULACAO = [
  "PS DECISÃO CLINICA",
  "PS DECISÃO CIRURGICA",
  "CC - RECUPERAÇÃO",
];

const SETOR_EXCLUIDO = "UNID. DE AVC - INTEGRAL";

export class RegulacaoService {
  static normalizarTexto(valor: string) {
    return ScoreRegulacaoService.normalizarTexto(valor);
  }

  static isPacienteElegivelParaRegulacao(paciente: any, setoresPoolIds: Set<string>, setoresPoolNormalizados: Set<string>): boolean {
    if (paciente?.regulacaoAtiva || paciente?.altaAposRPA) {
      return false;
    }

    if (paciente?.setorId && setoresPoolIds.has(String(paciente.setorId))) {
      return true;
    }

    const setorPacienteNorm = this.normalizarTexto(
      paciente?.setorNome || paciente?.localizacaoAtual || paciente?.setorOrigem || "",
    );

    return !!setorPacienteNorm && setoresPoolNormalizados.has(setorPacienteNorm);
  }

  static processarSugestoes(
    setoresDisponiveis: any[],
    pacientesEnriquecidos: any[],
    infeccoesMap: Map<string, any>,
    hospitalData: any
  ) {
    const estruturaArray = validateHospitalData(hospitalData);

    const setoresPorNome = new Map(estruturaArray.map((s: any) => [
      this.normalizarTexto(s?.nomeSetor || s?.nome || s?.siglaSetor),
      s
    ]));

    const setoresPoolIds = new Set(
      SETORES_POOL_REGULACAO.map(nome => {
        const id = setoresPorNome.get(this.normalizarTexto(nome))?.id;
        return id ? String(id) : null;
      }).filter(Boolean) as string[]
    );
    const setoresPoolNormalizados = new Set(SETORES_POOL_REGULACAO.map(nome => this.normalizarTexto(nome)));

    let pacientesElegiveis = (pacientesEnriquecidos || []).filter(p => {
      if (p?.regulacaoAtiva || p?.altaAposRPA) return false;
      return this.isPacienteElegivelParaRegulacao(p, setoresPoolIds, setoresPoolNormalizados);
    });

    console.debug(`[RegulacaoService] total pacientes recebidos: ${pacientesEnriquecidos?.length || 0}`);
    console.debug(`[RegulacaoService] total pacientes após filtro elegibilidade estrito: ${pacientesElegiveis.length}`);

    if (pacientesElegiveis.length === 0 && (pacientesEnriquecidos || []).length > 0) {
      console.debug(`[RegulacaoService] Ativando LEGACY MODE Global: usando todos os pacientes não regulados.`);
      pacientesElegiveis = (pacientesEnriquecidos || []).filter(p => !(p?.regulacaoAtiva || p?.altaAposRPA));
      console.debug(`[RegulacaoService] total pacientes após LEGACY MODE: ${pacientesElegiveis.length}`);
    }

    const leitosCompativeisPorPaciente = new Map();
    pacientesElegiveis.forEach(paciente => {
      const leitosCompat = encontrarLeitosCompativeis(paciente, hospitalData, "enfermaria");
      leitosCompativeisPorPaciente.set(
        paciente.id,
        new Set((leitosCompat || []).map((l: any) => String(l.id)))
      );
    });

    const setorExcluidoNorm = this.normalizarTexto(SETOR_EXCLUIDO);

    const totalLeitos = setoresDisponiveis.reduce((acc, setor) => acc + (setor?.leitosVagos?.length || 0), 0);
    console.debug(`[RegulacaoService] total leitos recebidos: ${totalLeitos}`);
    if (totalLeitos > 0 && setoresDisponiveis[0]?.leitosVagos?.[0]) {
      console.debug(`[RegulacaoService] exemplo leito:`, JSON.stringify(setoresDisponiveis[0].leitosVagos[0], null, 2));
    }

    const resultado = setoresDisponiveis
      .filter((setor) => CompatibilidadeLeitoService.normalizeTipoLeito(setor?.tipoSetor) === "enfermaria")
      .filter((setor) => this.normalizarTexto(setor?.nomeSetor) !== setorExcluidoNorm)
      .map((setor) => {
        const leitosComSugestoes = setor.leitosVagos
          .map((leito: any) => {
            const fhirLocation = FhirMapper.toLocation(leito, setor);
            
            const filterPatients = (legacyMode: boolean) => {
              return pacientesElegiveis.filter(pacienteLegado => {
                if (!pacienteLegado || !pacienteLegado.id) {
                  console.debug(`[RegulacaoService] paciente ${pacienteLegado?.id} eliminado: motivo=SEM_DADOS`);
                  return false;
                }

                const leitosPaciente = leitosCompativeisPorPaciente.get(pacienteLegado.id);
                if (!leitosPaciente || !leitosPaciente.has(String(leito.id))) {
                  console.debug(`[RegulacaoService] paciente ${pacienteLegado.id} eliminado: motivo=LEITO_NAO_COMPATIVEL_REGRAS`);
                  return false;
                }

                const fhirPatient = FhirMapper.toPatient(pacienteLegado);
                const isCompativel = CompatibilidadeLeitoService.isLeitoCompativel(
                  fhirPatient,
                  fhirLocation,
                  setor.nomeSetor,
                  encontrarLeitosCompativeis,
                  pacienteLegado,
                  hospitalData,
                  legacyMode
                );

                if (!isCompativel) {
                  console.debug(`[RegulacaoService] paciente ${pacienteLegado.id} eliminado: motivo=ESPECIALIDADE_INCOMPATIVEL_OU_STATUS`);
                  return false;
                }

                console.debug(`[RegulacaoService] paciente ${pacienteLegado.id} aprovado (legacyMode=${legacyMode})`);
                return true;
              });
            };

            let pacientesCompativeis = filterPatients(false);
            
            if (pacientesCompativeis.length === 0) {
              console.debug(`[RegulacaoService] leito ${leito.id} sem sugestões estritas. Ativando LEGACY MODE.`);
              pacientesCompativeis = filterPatients(true);
            }

            const sugestoes = pacientesCompativeis
              .map(pacienteLegado => {
                const fhirPatient = FhirMapper.toPatient(pacienteLegado);
                const fhirEncounter = FhirMapper.toEncounter(pacienteLegado);
                const fhirFlags = FhirMapper.toFlags(pacienteLegado, infeccoesMap);

                const scoreResult = ScoreRegulacaoService.calcularScore(fhirPatient, fhirEncounter, fhirFlags);
                const isolamentos = fhirFlags.map(f => f.code.text);

                return {
                  ...pacienteLegado,
                  nome: fhirPatient.name,
                  sexo: fhirPatient.gender,
                  especialidade: pacienteLegado.especialidade || "Não informado",
                  scoreTotal: scoreResult.scoreTotal,
                  scoreMotivos: scoreResult.motivos,
                  isolamentos,
                  temIsolamento: fhirFlags.length > 0,
                  idade: ScoreRegulacaoService.calcularIdade(fhirPatient.birthDate)
                };
              })
              .sort((a, b) => {
                if (b.scoreTotal !== a.scoreTotal) return b.scoreTotal - a.scoreTotal;
                
                const timeA = a.dataInternacao ? new Date(a.dataInternacao).getTime() : 0;
                const timeB = b.dataInternacao ? new Date(b.dataInternacao).getTime() : 0;
                if (timeA !== timeB) return timeA - timeB;
                
                if (b.idade !== a.idade) return (b.idade || 0) - (a.idade || 0);
                return (a.nome || "").localeCompare(b.nome || "");
              });

            return {
              ...leito,
              codigo: leito.codigoLeito || leito.codigo,
              sugestoes,
            };
          })
          .filter((leito: any) => leito.sugestoes.length > 0);

        if (!leitosComSugestoes.length) return null;

        return {
          id: setor.id,
          nome: setor.nomeSetor,
          leitos: leitosComSugestoes,
        };
      })
      .filter(Boolean);

    let totalSugestoes = 0;
    resultado.forEach(s => s.leitos.forEach(l => totalSugestoes += l.sugestoes.length));
    console.debug(`[RegulacaoService] total sugestões geradas: ${totalSugestoes}`);

    return resultado;
  }
}
