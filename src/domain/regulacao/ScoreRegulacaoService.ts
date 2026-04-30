import config from '../../config/scoreRegulacao.json';
import { FhirPatient, FhirEncounter, FhirFlag } from './types';

export class ScoreRegulacaoService {
  static calcularScore(patient: FhirPatient, encounter: FhirEncounter, flags: FhirFlag[]) {
    let score = 0;
    const motivos: string[] = [];
    const { criterios, limites } = config;

    const temIsolamento = flags.length > 0;
    if (temIsolamento) {
      score += criterios.isolamento;
      motivos.push(`Possui isolamento compatível com o leito (+${criterios.isolamento})`);
    }

    const idade = this.calcularIdade(patient.birthDate);
    if (idade !== null) {
      if (idade >= 80) {
        score += criterios.idade_80;
        motivos.push(`Paciente Superidoso >80a (+${criterios.idade_80})`);
      } else if (idade >= 60) {
        score += criterios.idade_60;
        motivos.push(`Estatuto do Idoso >60a (+${criterios.idade_60})`);
      }
    }

    const origemExt = patient.extension?.find(e => e.url === 'origem')?.valueString || '';
    const origemNorm = this.normalizarTexto(origemExt);

    if (origemNorm.includes("CC - RECUPERACAO") || origemNorm.includes("RECUPERACAO") || origemNorm === "CC RECU") {
      score += criterios.rpa;
      motivos.push(`Retenção em RPA trava o CC (+${criterios.rpa})`);
    } else if (origemNorm.includes("PS DECISAO") || origemNorm === "DCL" || origemNorm === "DCX") {
      score += criterios.ps_decisao;
      motivos.push(`Retenção no Pronto Socorro (+${criterios.ps_decisao})`);
    }

    const dias = this.calcularDiasInternado(encounter.period.start);
    if (dias > 0) {
      const ptsTempo = Math.min(limites.max_tempo, dias * (criterios.tempo_por_dia || 2));
      score += ptsTempo;
      motivos.push(`Aguardando há ${dias} ${dias === 1 ? "dia" : "dias"} (+${ptsTempo})`);
    }

    return {
      scoreTotal: Math.min(limites.max_score, score),
      motivos
    };
  }

  static calcularIdade(dataNascimento: any): number | null {
    if (!dataNascimento) return null;
    let birth: Date;
    if (dataNascimento instanceof Date) birth = dataNascimento;
    else if (dataNascimento.seconds) birth = new Date(dataNascimento.seconds * 1000);
    else if (typeof dataNascimento === 'string') birth = new Date(dataNascimento);
    else return null;

    if (isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  static normalizarTexto(valor: string): string {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim();
  }

  static calcularDiasInternado(dataInternacao: any): number {
    if (!dataInternacao) return 0;
    let data: Date;
    if (dataInternacao instanceof Date) data = dataInternacao;
    else if (dataInternacao.seconds) data = new Date(dataInternacao.seconds * 1000);
    else if (typeof dataInternacao === 'string') data = new Date(dataInternacao);
    else return 0;

    const ms = Date.now() - data.getTime();
    if (ms <= 0) return 0;
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }
}
