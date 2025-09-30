// src/lib/compatibilidadeUtils.js

const normalizarData = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string' || typeof valor === 'number') {
    const parsed = new Date(valor);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (typeof valor === 'object' && typeof valor.seconds === 'number') {
    return new Date(valor.seconds * 1000);
  }
  return null;
};

const calcularIdade = (dataNascimento) => {
  const data = normalizarData(dataNascimento);
  if (!data) return null;

  const agora = new Date();
  let idade = agora.getFullYear() - data.getFullYear();
  const mes = agora.getMonth() - data.getMonth();
  if (mes < 0 || (mes === 0 && agora.getDate() < data.getDate())) {
    idade -= 1;
  }
  return idade;
};

const getChavesIsolamentoAtivo = (paciente) => {
  if (!paciente || !Array.isArray(paciente.isolamentos)) return new Set();
  return new Set(
    paciente.isolamentos
      .filter(iso => iso.statusConsideradoAtivo)
      .map(iso => (iso.siglaInfeccao || iso.sigla || '').toLowerCase())
      .filter(Boolean)
  );
};

export const encontrarLeitosCompativeis = (pacienteAlvo, hospitalData, modo = 'enfermaria') => {
  const { estrutura } = hospitalData;
  if (!pacienteAlvo || !estrutura) return [];

  const setoresIterable = Array.isArray(estrutura)
    ? estrutura
    : Object.values(estrutura).flat();

  const tipoSetorAlvo = (modo === 'uti' ? 'UTI' : 'ENFERMARIA');
  const idade = calcularIdade(pacienteAlvo.dataNascimento);
  const chavesPaciente = getChavesIsolamentoAtivo(pacienteAlvo);

  const leitosCompativeis = [];

  const avaliarLeito = (leito, leitosDoQuarto = [leito]) => {
    if (!['Vago', 'Higienização'].includes(leito.status)) return;

    if (modo === 'uti') {
      leitosCompativeis.push(leito);
      return;
    }

    // Regra PCP
    if (leito.isPCP) {
      if (
        idade == null ||
        idade < 18 ||
        idade > 60 ||
        chavesPaciente.size > 0 ||
        (pacienteAlvo.setorOrigem || '').toUpperCase() === 'CC - RECUPERAÇÃO'
      ) {
        return; // Rejeitado
      }
    }

    // Regras de Coorte (Sexo e Isolamento)
    const coorte = leito.restricaoCoorte;
    const outrosLeitosDoQuarto = (leitosDoQuarto || []).filter((outro) => outro?.id !== leito.id);
    const quartoDisponivelParaIsolamento = outrosLeitosDoQuarto.every((outro) =>
      ['Vago', 'Higienização'].includes(outro?.status)
    );

    if (coorte) { // Quarto ocupado
      if (pacienteAlvo.sexo !== coorte.sexo) return; // Rejeita por sexo
      const isolamentosCoorte = new Set(coorte.isolamentos || []);

      if (chavesPaciente.size > 0) {
        const todosIsolamentosCompativeis = [...chavesPaciente].every((c) => isolamentosCoorte.has(c));
        if (!todosIsolamentosCompativeis) {
          return; // Rejeita por isolamento incompatível
        }
      } else if (isolamentosCoorte.size > 0) {
        return; // Paciente sem isolamento não pode entrar em quarto com isolamento ativo
      }
    } else if (chavesPaciente.size > 0 && !quartoDisponivelParaIsolamento) {
      return; // Rejeita se paciente tem isolamento e quarto não está completamente vazio
    }

    leitosCompativeis.push(leito);
  };

  setoresIterable.forEach(setor => {
    if ((setor.tipoSetor || '').toUpperCase() !== tipoSetorAlvo) return;

    (setor.quartos || []).forEach(quarto => {
      const leitosQuarto = quarto.leitos || [];
      leitosQuarto.forEach(leitoQuarto => avaliarLeito(leitoQuarto, leitosQuarto));
    });

    (setor.leitosSemQuarto || []).forEach(leitoIsolado => avaliarLeito(leitoIsolado, [leitoIsolado]));
  });

  return leitosCompativeis;
};

export { calcularIdade, getChavesIsolamentoAtivo };
