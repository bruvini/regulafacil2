import { intervalToDuration } from "date-fns";

export class SugestoesRegulacaoFormatters {
  static parseDataFlexivel(valor: any): Date | null {
    if (!valor) return null;
    if (valor instanceof Date) return valor;
    if (typeof valor === "string") {
      const texto = valor.trim();
      if (!texto) return null;
      if (/^\d{2}\/\d{2}\/\d{4}/.test(texto)) {
        const [dataParte, horaParte] = texto.split(" ");
        const [dia, mes, ano] = dataParte.split("/").map(parte => parseInt(parte, 10));
        if (Number.isNaN(dia) || Number.isNaN(mes) || Number.isNaN(ano)) return null;
        if (horaParte && /^\d{2}:\d{2}/.test(horaParte)) {
          const [hora, minuto] = horaParte.split(":").map(parte => parseInt(parte, 10));
          return new Date(ano, mes - 1, dia, hora || 0, minuto || 0);
        }
        return new Date(ano, mes - 1, dia);
      }
      const data = new Date(texto);
      return Number.isNaN(data.getTime()) ? null : data;
    }
    if (typeof valor === "object") {
      if (typeof valor.toDate === "function") {
        const data = valor.toDate();
        return Number.isNaN(data?.getTime?.()) ? null : data;
      }
      if (typeof valor.seconds === "number") {
        return new Date(valor.seconds * 1000);
      }
    }
    return null;
  }

  static obterInfoTempoInternacao(dataInternacao: any) {
    const data = this.parseDataFlexivel(dataInternacao);
    if (!data) {
      return { timestamp: Number.POSITIVE_INFINITY, texto: "Tempo de internação não informado" };
    }
    const inicio = data.getTime();
    const agora = Date.now();
    const inicioNormalizado = Math.min(inicio, agora);
    const fimNormalizado = Math.max(inicio, agora);

    const duration = intervalToDuration({
      start: new Date(inicioNormalizado),
      end: new Date(fimNormalizado),
    });

    const totalDias = Math.floor((fimNormalizado - inicioNormalizado) / (1000 * 60 * 60 * 24));
    const horasRestantes = duration.hours ?? 0;
    const minutosRestantes = duration.minutes ?? 0;

    const partes = [];
    if (totalDias > 0) partes.push(`${totalDias}d`);
    if (horasRestantes > 0 || (totalDias > 0 && minutosRestantes > 0)) partes.push(`${horasRestantes}h`);
    if (minutosRestantes > 0) partes.push(`${minutosRestantes}m`);
    if (!partes.length) partes.push("0m");

    return { timestamp: inicio, texto: partes.join(" ") };
  }

  static formatarDataPrevistaAlta(valor: any): string | null {
    if (!valor) return null;
    const data = this.parseDataFlexivel(valor);
    if (!data) return String(valor).trim() || null;
    const dd = String(data.getDate()).padStart(2, "0");
    const mm = String(data.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  }

  static formatarSexo(valor: any): string {
    const texto = String(valor || "").trim();
    if (!texto) return "Sexo não informado";
    const base = texto.toLowerCase();
    if (base.startsWith("m")) return "Masculino";
    if (base.startsWith("f")) return "Feminino";
    if (base.startsWith("i")) return "Intersexo";
    if (base.startsWith("o")) return "Outro";
    return texto;
  }

  static obterTextoValido(valor: any): string | null {
    const texto = String(valor ?? "").trim();
    return texto || null;
  }

  static normalizarCodigoLeito(valor: any): string | null {
    const texto = this.obterTextoValido(valor);
    return texto ? texto.toUpperCase() : null;
  }

  static obterSetorOrigemTextoFallback(paciente: any): string {
    const candidato = [
      paciente?.setorOrigemNome,
      paciente?.setorOrigemSigla,
      paciente?.setorOrigem,
      paciente?.origemSetorNome,
      paciente?.setorNome,
      paciente?.localizacaoAtual,
      paciente?.setor,
    ].map(this.obterTextoValido.bind(this)).find(Boolean);
    return candidato || "Não informado";
  }

  static obterLeitoOrigemTextoFallback(paciente: any): string {
    const candidato = [
      paciente?.leitoOrigemCodigo,
      paciente?.leitoOrigem,
      paciente?.leitoAtualCodigo,
      paciente?.leitoAtual,
      paciente?.leitoNome,
      paciente?.leito,
    ].map(this.obterTextoValido.bind(this)).find(Boolean);
    return candidato || "Não informado";
  }

  static encontrarLeitoPaciente(paciente: any, leitosPorId: Map<string, any>, leitosPorCodigo: Map<string, any>) {
    if (!paciente) return null;
    const candidatosId = [
      paciente?.leitoId, paciente?.leitoOrigemId, paciente?.leitoAtualId,
      paciente?.leito?.id, paciente?.leito?.leitoId, paciente?.leitoAtual?.id,
      paciente?.regulacaoAtiva?.leitoOrigemId,
    ].filter(Boolean);

    for (const id of candidatosId) {
      const leito = leitosPorId.get(id);
      if (leito) return leito;
    }

    const candidatosCodigo = [
      paciente?.leitoOrigemCodigo, paciente?.leitoOrigem, paciente?.leitoAtualCodigo,
      paciente?.leitoAtual, paciente?.leitoNome, paciente?.leito,
      paciente?.codigoLeito, paciente?.leito?.codigoLeito, paciente?.leito?.codigo,
    ].map(v => this.normalizarCodigoLeito(v)).filter(Boolean);

    for (const codigo of candidatosCodigo) {
      const leito = leitosPorCodigo.get(codigo);
      if (leito) return leito;
    }
    return null;
  }

  static encontrarSetorPaciente(paciente: any, setoresPorId: Map<string, any>, leitosPorId: Map<string, any>, leitosPorCodigo: Map<string, any>, leitoEncontrado: any) {
    if (!paciente) return null;
    const candidatosId = [
      paciente?.setorId, paciente?.setorOrigemId, paciente?.setor?.id,
      paciente?.setorOrigem?.id, paciente?.regulacaoAtiva?.setorOrigemId,
    ].filter(Boolean);

    for (const id of candidatosId) {
      const setor = setoresPorId.get(id);
      if (setor) return setor;
    }

    const leito = leitoEncontrado || this.encontrarLeitoPaciente(paciente, leitosPorId, leitosPorCodigo);
    if (leito) {
      const setorDoLeito = setoresPorId.get(leito.setorId);
      if (setorDoLeito) return setorDoLeito;
    }
    return null;
  }

  static obterLocalizacaoPaciente(paciente: any, setoresPorId: Map<string, any>, leitosPorId: Map<string, any>, leitosPorCodigo: Map<string, any>) {
    const fallbackSetor = this.obterSetorOrigemTextoFallback(paciente);
    const fallbackLeito = this.obterLeitoOrigemTextoFallback(paciente);

    const leito = this.encontrarLeitoPaciente(paciente, leitosPorId, leitosPorCodigo);
    const setor = this.encontrarSetorPaciente(paciente, setoresPorId, leitosPorId, leitosPorCodigo, leito);

    const setorPreferencial = this.obterTextoValido(setor?.siglaSetor) || this.obterTextoValido(setor?.nomeSetor || setor?.nome) || (fallbackSetor !== "Não informado" ? fallbackSetor : null);
    const leitoPreferencial = this.obterTextoValido(leito?.codigoLeito || leito?.codigo) || (fallbackLeito !== "Não informado" ? fallbackLeito : null);

    const localizacaoTexto = setorPreferencial ? leitoPreferencial ? `${setorPreferencial} - ${leitoPreferencial}` : setorPreferencial : leitoPreferencial || "Não informado";

    return {
      setorTexto: setorPreferencial || fallbackSetor,
      leitoTexto: leitoPreferencial || fallbackLeito,
      localizacaoTexto,
    };
  }
}
