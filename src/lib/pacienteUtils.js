// src/lib/pacienteUtils.js

import { getInfeccoesCollection, getDoc, doc } from '@/lib/firebase';

/**
 * Normaliza o campo 'sexo' para 'M' ou 'F'.
 * Se vier qualquer outra coisa, retorna null (indefinido) para forçar a compatibilidade a ser conservadora.
 */
const normalizarSexo = (valor) => {
  const v = (typeof valor === 'string' ? valor.trim().toUpperCase() : '');
  if (v === 'M') return 'M';
  if (v === 'F') return 'F';
  return null;
};

/**
 * Normaliza APENAS a ESTRUTURA do paciente.
 * NÃO altera o CONTEÚDO de cada item de `isolamentos`.
 */
export const normalizarEstruturaPaciente = (paciente) => {
  if (!paciente) return null;
  const out = { ...paciente };

  // leitoId como string
  if (out.leitoId && typeof out.leitoId === 'object') out.leitoId = out.leitoId.id;
  if (out.leitoId) out.leitoId = String(out.leitoId);

  // sexo
  out.sexo = normalizarSexo(out.sexo);

  // isolamentos sempre array
  if (!Array.isArray(out.isolamentos)) out.isolamentos = [];

  console.log('[PacienteUtils] (estrutura) paciente:', {
    nome: out?.nomePaciente, sexo: out?.sexo, leitoId: out?.leitoId, isolamentos: out?.isolamentos
  });

  return out;
};

/**
 * Enriquecimento dos isolamentos usando a coleção de infecções.
 * - Usa cache (infeccoesMap) quando disponível
 * - Nunca descarta isolamentos válidos por falha de fetch
 * - Prioriza sigla/nome da infecção; NÃO usa infeccaoId como sigla/nome
 */
const enriquecerIsolamentos = async (isolamentos, infeccoesMap) => {
  if (!Array.isArray(isolamentos) || !infeccoesMap) return [];

  const result = await Promise.all(
    isolamentos.map(async (iso) => {
      if (!iso || typeof iso !== 'object') return null;

      const infeccaoRef = iso.infeccaoId ?? iso.infecaoId;
      const infeccaoId =
        typeof infeccaoRef === 'object' && infeccaoRef ? (infeccaoRef.id || null)
        : (typeof infeccaoRef === 'string' ? infeccaoRef : null);

      // base sem poluição
      const base = {
        ...iso,
        infeccaoId: infeccaoId || null,
        // NÃO colocar sigla/nome a partir de infeccaoId!
      };

      if (!infeccaoId) {
        // Sem referência de infecção — mantém o que tiver (se vier com sigla/nome já preenchidos)
        return {
          ...base,
          sigla: base.sigla || base.siglaInfeccao || base.nome || base.nomeInfeccao || '', // última chance
          nome: base.nome || base.nomeInfeccao || base.sigla || '',
        };
      }

      let inf = infeccoesMap.get(infeccaoId);
      if (!inf) {
        try {
          const snap = await getDoc(doc(getInfeccoesCollection(), infeccaoId));
          if (snap.exists()) {
            inf = { id: snap.id, ...snap.data() };
            infeccoesMap.set(infeccaoId, inf);
          }
        } catch (e) {
          console.error('[PacienteUtils] erro ao buscar infeccao', infeccaoId, e);
        }
      }

      // Mescla, priorizando dados do cadastro de infecção
      const merged = { ...base, ...(inf || {}) };
      const siglaFinal = merged.siglaInfeccao || merged.sigla || base.sigla || base.nome || '';
      const nomeFinal  = merged.nomeInfeccao  || merged.nome  || base.nome  || siglaFinal || '';

      return { ...merged, sigla: siglaFinal, nome: nomeFinal };
    })
  );

  // Mantém isolamentos com alguma identificação (sigla ou nome)
  const limpos = result.filter(i => i && (i.sigla || i.nome));

  console.log('[PacienteUtils] (enriquecidos) isolamentos:', limpos);
  return limpos;
};

/**
 * Pipeline completo do paciente: estrutura + enriquecimento de isolamentos.
 */
export const processarPaciente = async (paciente, infeccoesMap = new Map()) => {
  const p = normalizarEstruturaPaciente(paciente);
  if (!p) return null;

  const isolamentos = await enriquecerIsolamentos(p.isolamentos, infeccoesMap);
  const final = { ...p, isolamentos };

  console.log('[PacienteUtils] (final) paciente:', {
    nome: final?.nomePaciente, sexo: final?.sexo, leitoId: final?.leitoId, isolamentos: final?.isolamentos
  });

  return final;
};
