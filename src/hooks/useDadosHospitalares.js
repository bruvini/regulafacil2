// src/hooks/useDadosHospitalares.js
import React, { useEffect, useMemo } from 'react';
import { usePacientes, useLeitos, useSetores, useInfeccoes } from './useCollections';
import { useAuth } from '@/contexts/AuthContext';
import { verificarEFinalizarPedidosUTIAtendidos } from '@/lib/utiUtils';

// Função interna para processar e enriquecer os dados
const processarDados = (pacientes, leitos, setores, infeccoes) => {
  if (!leitos.length || !setores.length) {
    return { estrutura: {}, pacientesEnriquecidos: [], infeccoesMap: new Map() };
  }

  const infeccoesMap = new Map(infeccoes.map(i => [i.id, i]));

  const pacientesEnriquecidos = pacientes.map(p => {
    const isolamentos = (p.isolamentos || []).map(iso => {
      const infeccaoId = typeof iso.infeccaoId === 'object' ? iso.infeccaoId.id : iso.infeccaoId;
      const dadosInfeccao = infeccoesMap.get(infeccaoId);
      const statusAtivo = ['confirmado', 'suspeito'].includes((iso.status || '').toLowerCase());
      return { ...iso, ...dadosInfeccao, statusConsideradoAtivo: statusAtivo };
    }).filter(Boolean);
    return { ...p, isolamentos };
  });

  const pacientesPorLeitoId = new Map(
    pacientesEnriquecidos
      .filter(p => p.leitoId)
      .map(p => [p.leitoId, p])
  );

  const leitosPorId = new Map(leitos.map(leito => [leito.id, leito]));
  const setoresPorId = new Map(setores.map(setor => [setor.id, setor]));

  const regulacoesOrigemPorLeito = {};
  const regulacoesDestinoPorLeito = {};

  pacientesEnriquecidos.forEach(paciente => {
    const regulacao = paciente.regulacaoAtiva;
    if (regulacao?.leitoOrigemId && regulacao?.leitoDestinoId) {
      const leitoOrigem = leitosPorId.get(regulacao.leitoOrigemId);
      const leitoDestino = leitosPorId.get(regulacao.leitoDestinoId);
      const setorOrigem = leitoOrigem ? setoresPorId.get(leitoOrigem.setorId) : null;
      const setorDestino = setoresPorId.get(regulacao.setorDestinoId || leitoDestino?.setorId) || null;
      const timestamp = regulacao.timestamp || regulacao.iniciadoEm || null;

      regulacoesOrigemPorLeito[regulacao.leitoOrigemId] = {
        destinoCodigo: regulacao.leitoDestinoCodigo || leitoDestino?.codigoLeito || 'N/A',
        destinoSetorNome: regulacao.leitoDestinoSetorNome
          || setorDestino?.nomeSetor
          || setorDestino?.siglaSetor
          || 'Setor não informado',
        timestamp,
        pacienteNome: paciente.nomePaciente,
      };

      regulacoesDestinoPorLeito[regulacao.leitoDestinoId] = {
        pacienteNome: paciente.nomePaciente,
        origemCodigo: regulacao.leitoOrigemCodigo || leitoOrigem?.codigoLeito || 'N/A',
        origemSetorNome: regulacao.leitoOrigemSetorNome
          || setorOrigem?.nomeSetor
          || setorOrigem?.siglaSetor
          || 'Setor não informado',
        timestamp,
      };
    }
  });

  const normalizarCodigo = (valor) => String(valor || '').trim();

  const estruturaPorTipo = {};

  setores.forEach(setor => {
    const tipoSetorLabel = setor.tipoSetor || 'Outros';
    if (!estruturaPorTipo[tipoSetorLabel]) {
      estruturaPorTipo[tipoSetorLabel] = [];
    }

    const leitosDoSetor = leitos
      .filter(leito => leito.setorId === setor.id)
      .map(leito => {
        const paciente = pacientesPorLeitoId.get(leito.id) || null;
        const regulacaoOrigem = regulacoesOrigemPorLeito[leito.id]
          || (leito.regulacaoEmAndamento?.tipo === 'ORIGEM'
            ? {
                destinoCodigo: leito.regulacaoEmAndamento.leitoParceiroCodigo || 'N/A',
                destinoSetorNome: leito.regulacaoEmAndamento.leitoParceiroSetorNome || 'Setor não informado',
                timestamp: leito.regulacaoEmAndamento.iniciadoEm,
                pacienteNome: leito.regulacaoEmAndamento.pacienteNome,
              }
            : null);

        const regulacaoDestino = regulacoesDestinoPorLeito[leito.id]
          || (leito.regulacaoEmAndamento?.tipo === 'DESTINO'
            ? {
                pacienteNome: leito.regulacaoEmAndamento.pacienteNome,
                origemCodigo: leito.regulacaoEmAndamento.leitoParceiroCodigo || 'N/A',
                origemSetorNome: leito.regulacaoEmAndamento.leitoParceiroSetorNome || null,
                timestamp: leito.regulacaoEmAndamento.iniciadoEm,
              }
            : null);

        let statusAjustado = leito.status;
        if (regulacaoOrigem) {
          statusAjustado = 'Regulado';
        } else if (regulacaoDestino) {
          statusAjustado = 'Reservado';
        } else if (paciente) {
          statusAjustado = 'Ocupado';
        }

        return {
          ...leito,
          paciente,
          status: statusAjustado,
          nomeSetor: setor.nomeSetor || setor.nome || '',
          siglaSetor: setor.siglaSetor || '',
          tipoSetor: tipoSetorLabel,
          regulacaoOrigem,
          regulacaoReserva: regulacaoDestino,
          restricaoCoorte: null,
        };
      })
      .sort((a, b) => normalizarCodigo(a.codigoLeito).localeCompare(normalizarCodigo(b.codigoLeito)));

    let quartos = [];
    let leitosSemQuarto = [...leitosDoSetor];

    if ((tipoSetorLabel || '').toUpperCase() === 'ENFERMARIA') {
      const quartosMap = leitosDoSetor.reduce((acc, leitoAtual) => {
        const codigo = normalizarCodigo(leitoAtual.codigoLeito);
        const chave = (codigo.substring(0, 3) || '---').toUpperCase();
        if (!acc[chave]) {
          acc[chave] = {
            id: `quarto-${setor.id}-${chave}`,
            nomeQuarto: `Quarto ${chave}`,
            leitos: [],
          };
        }
        acc[chave].leitos.push(leitoAtual);
        return acc;
      }, {});

      quartos = Object.values(quartosMap)
        .map(quarto => ({
          ...quarto,
          leitos: quarto.leitos.sort((a, b) => normalizarCodigo(a.codigoLeito).localeCompare(normalizarCodigo(b.codigoLeito))),
        }))
        .sort((a, b) => (a.nomeQuarto || '').localeCompare(b.nomeQuarto || ''));

      quartos.forEach(quarto => {
        const ocupantes = quarto.leitos.map(l => l.paciente).filter(Boolean);
        if (!ocupantes.length) {
          quarto.leitos.forEach(leito => {
            leito.restricaoCoorte = null;
          });
          return;
        }

        const sexos = new Set(ocupantes.map(o => o.sexo).filter(Boolean));
        const isolamentosAtivosIds = new Set();
        const isolamentosAtivosRotulos = new Set();

        ocupantes.forEach(o => {
          (o.isolamentos || [])
            .filter(iso => iso.statusConsideradoAtivo)
            .forEach(iso => {
              const id = iso?.infeccaoId?.id ?? iso?.infeccaoId ?? iso?.infeccao?.id ?? iso?.idInfeccao ?? iso?.id;
              if (id !== undefined && id !== null) {
                isolamentosAtivosIds.add(String(id));
              }

              const rotulo = (iso.siglaInfeccao || iso.sigla || iso.nome || '').toUpperCase();
              if (rotulo) {
                isolamentosAtivosRotulos.add(rotulo);
              }
            });
        });

        if (sexos.size === 1) {
          const restricao = {
            sexo: [...sexos][0],
            isolamentos: [...isolamentosAtivosRotulos],
            isolamentosIds: [...isolamentosAtivosIds],
          };

          quarto.leitos.forEach(leito => {
            if (['Vago', 'Higienização'].includes(leito.status)) {
              leito.restricaoCoorte = restricao;
            } else {
              leito.restricaoCoorte = null;
            }
          });
        } else {
          quarto.leitos.forEach(leito => {
            leito.restricaoCoorte = null;
          });
        }
      });

      leitosSemQuarto = [];
    } else {
      leitosSemQuarto = leitosSemQuarto.sort((a, b) => normalizarCodigo(a.codigoLeito).localeCompare(normalizarCodigo(b.codigoLeito)));
    }

    estruturaPorTipo[tipoSetorLabel].push({
      ...setor,
      tipoSetor: tipoSetorLabel,
      nomeSetor: setor.nomeSetor || setor.nome || '',
      siglaSetor: setor.siglaSetor || '',
      quartos,
      leitosSemQuarto,
    });
  });

  Object.values(estruturaPorTipo).forEach(listaSetores => {
    listaSetores.sort((a, b) => (a.nomeSetor || '').localeCompare(b.nomeSetor || ''));
  });

  return { estrutura: estruturaPorTipo, pacientesEnriquecidos, infeccoesMap };
};

export const useDadosHospitalares = () => {
  const { data: pacientes, loading: loadingPacientes } = usePacientes();
  const { data: leitos, loading: loadingLeitos } = useLeitos();
  const { data: setores, loading: loadingSetores } = useSetores();
  const { data: infeccoes, loading: loadingInfeccoes } = useInfeccoes();
  const { currentUser } = useAuth();

  const isLoading = loadingPacientes || loadingLeitos || loadingSetores || loadingInfeccoes;

  const dadosProcessados = useMemo(() => {
    if (isLoading) return { estrutura: {}, pacientesEnriquecidos: [], infeccoesMap: new Map() };
    return processarDados(pacientes, leitos, setores, infeccoes);
  }, [pacientes, leitos, setores, infeccoes, isLoading]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const finalizarPedidos = async () => {
      try {
        await verificarEFinalizarPedidosUTIAtendidos(pacientes, leitos, setores, currentUser);
      } catch (error) {
        console.error('Não foi possível finalizar automaticamente pedidos de UTI atendidos:', error);
      }
    };

    finalizarPedidos();
  }, [isLoading, pacientes, leitos, setores, currentUser]);

  return {
    ...dadosProcessados,
    pacientes,
    leitos,
    setores,
    infeccoes,
    loading: isLoading,
  };
};
