import { getInfeccoesCollection, getDoc, doc } from '@/lib/firebase';

/**
 * Normaliza o campo 'sexo' para 'M' ou 'F'.
 * Assume 'F' como padrão se o valor não for 'M'.
 */
const normalizarSexo = (valor) => {
  if (typeof valor === 'string' && valor.trim().toUpperCase() === 'M') {
    return 'M';
  }
  return 'F';
};

/**
 * Realiza uma normalização básica no objeto do paciente,
 * garantindo que leitoId seja uma string e o sexo seja padronizado.
 */
export const normalizarEstruturaPaciente = (paciente) => {
  if (!paciente) return null;

  const pacienteNormalizado = { ...paciente };

  if (pacienteNormalizado.leitoId && typeof pacienteNormalizado.leitoId === 'object') {
    pacienteNormalizado.leitoId = pacienteNormalizado.leitoId.id;
  }
  if (pacienteNormalizado.leitoId) {
    pacienteNormalizado.leitoId = String(pacienteNormalizado.leitoId);
  }

  pacienteNormalizado.sexo = normalizarSexo(pacienteNormalizado.sexo);

  console.log(
    '[PacienteUtils] Isolamentos brutos do paciente',
    pacienteNormalizado?.nomePaciente,
    pacienteNormalizado?.isolamentos
  );

  if (Array.isArray(pacienteNormalizado.isolamentos)) {
    pacienteNormalizado.isolamentos = pacienteNormalizado.isolamentos
      .filter(Boolean)
      .map((isolamentoOriginal) => {
        console.log('[PacienteUtils] Processando isolamento:', isolamentoOriginal);
        if (!isolamentoOriginal || typeof isolamentoOriginal !== 'object') {
          return isolamentoOriginal;
        }

        const isolamento = { ...isolamentoOriginal };
        const infeccaoRef = isolamento.infeccaoId ?? isolamento.infecaoId;

        let infeccaoId = null;
        if (typeof infeccaoRef === 'string') {
          infeccaoId = infeccaoRef;
        } else if (typeof infeccaoRef === 'object' && infeccaoRef) {
          infeccaoId = infeccaoRef.id || null;
        }

        const siglaBase =
          isolamento.sigla ||
          isolamento.siglaInfeccao ||
          (infeccaoId ? String(infeccaoId) : '');

        const nomeBase = isolamento.nome || isolamento.nomeInfeccao || siglaBase || '';

        return {
          ...isolamento,
          infeccaoId: infeccaoId || isolamento.infeccaoId || isolamento.infecaoId || null,
          sigla: siglaBase || '',
          nome: nomeBase || '',
        };
      });
  } else {
    pacienteNormalizado.isolamentos = [];
  }

  console.log('[PacienteUtils] Paciente normalizado:', pacienteNormalizado);

  return pacienteNormalizado;
};

/**
 * Enriquece o array de isolamentos de um paciente, buscando os detalhes
 * da infecção (sigla, nome) a partir do infeccaoId.
 * Utiliza um mapa de cache para evitar buscas repetidas ao Firestore.
 */
const enriquecerIsolamentos = async (isolamentos, infeccoesMap) => {
  if (!Array.isArray(isolamentos) || !infeccoesMap) return [];

  const isolamentosEnriquecidos = await Promise.all(
    isolamentos.map(async (iso) => {
      if (!iso || !iso.infeccaoId) return iso;

      const infeccaoId = typeof iso.infeccaoId === 'object' ? iso.infeccaoId.id : String(iso.infeccaoId);
      let infeccaoData = infeccoesMap.get(infeccaoId);

      if (!infeccaoData) {
        try {
          const docRef = doc(getInfeccoesCollection(), infeccaoId);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            infeccaoData = { id: snapshot.id, ...snapshot.data() };
            infeccoesMap.set(infeccaoId, infeccaoData);
          }
        } catch (error) {
          console.error(`Erro ao buscar infecção ${infeccaoId}:`, error);
          return iso;
        }
      }

      return infeccaoData ? { ...iso, ...infeccaoData } : iso;
    })
  );

  return isolamentosEnriquecidos.filter(Boolean);
};

/**
 * Função principal que orquestra a normalização e o enriquecimento de um paciente.
 */
export const processarPaciente = async (paciente, infeccoesMap = new Map()) => {
  const pacienteNormalizado = normalizarEstruturaPaciente(paciente);
  if (!pacienteNormalizado) return null;

  const isolamentosDetalhados = await enriquecerIsolamentos(
    pacienteNormalizado.isolamentos,
    infeccoesMap
  );

  console.log('[PacienteUtils] Paciente enriquecido:', {
    nome: pacienteNormalizado?.nomePaciente,
    sexo: pacienteNormalizado?.sexo,
    leitoId: pacienteNormalizado?.leitoId,
    isolamentos: isolamentosDetalhados,
  });

  return { ...pacienteNormalizado, isolamentos: isolamentosDetalhados };
};
